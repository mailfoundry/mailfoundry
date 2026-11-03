/**
 * Nightly sync of web-shop purchase history onto MailFoundry contacts, so Segments can filter on
 * "bought from SWF / SCS in the last N months". Source: the shop's /api/internal/customers feed
 * (Bearer SCS_SYNC_SECRET). Only EXISTING contacts are updated — shop customers who aren't
 * MailFoundry contacts are never added or subscribed automatically.
 */
import { prisma } from "./prisma";

type FeedRow = { email: string; swfLastOrderAt: string | null; swfOrders: number; scsLastOrderAt: string | null; scsOrders: number };

export async function syncCustomerPurchases(months = 36) {
  const secret = process.env.SCS_SYNC_SECRET;
  if (!secret) throw new Error("SCS_SYNC_SECRET is not set");
  const base = (process.env.SCS_SITE_URL ?? "https://www.staffordshirecleaningsupplies.co.uk").replace(/\/$/, "");
  const res = await fetch(`${base}/api/internal/customers?months=${months}`, {
    headers: { Authorization: `Bearer ${secret}` },
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Shop customers feed returned ${res.status}`);
  const feed = ((await res.json()) as { customers: FeedRow[] }).customers;

  // email (lower-case) → contact id
  const contacts = await prisma.contact.findMany({ select: { id: true, email: true } });
  const idOf = new Map(contacts.map((c) => [c.email.trim().toLowerCase(), c.id]));

  const now = new Date();
  const matched = feed.filter((r) => idOf.has(r.email));
  // One bulk UPDATE per 1,000 contacts (individual updates in a transaction were too slow over Neon)
  for (let i = 0; i < matched.length; i += 1000) {
    const batch = matched.slice(i, i + 1000);
    const ids = batch.map((r) => idOf.get(r.email)!);
    const swfAt = batch.map((r) => r.swfLastOrderAt);
    const swfN = batch.map((r) => r.swfOrders);
    const scsAt = batch.map((r) => r.scsLastOrderAt);
    const scsN = batch.map((r) => r.scsOrders);
    await prisma.$executeRaw`
      UPDATE "Contact" AS c SET
        -- GREATEST keeps older history loaded from other sources (e.g. the old Shopify store)
        "swfLastOrderAt" = GREATEST(c."swfLastOrderAt", (v.swf_at::timestamptz AT TIME ZONE 'UTC')),
        "swfOrders" = GREATEST(c."swfOrders", v.swf_n),
        "scsLastOrderAt" = GREATEST(c."scsLastOrderAt", (v.scs_at::timestamptz AT TIME ZONE 'UTC')),
        "scsOrders" = GREATEST(c."scsOrders", v.scs_n),
        "purchasesSyncedAt" = ${now}
      FROM unnest(${ids}::text[], ${swfAt}::text[], ${swfN}::int[], ${scsAt}::text[], ${scsN}::int[])
        AS v(id, swf_at, swf_n, scs_at, scs_n)
      WHERE c.id = v.id`;
  }

  // Contacts with purchase data that are no longer in the feed (orders now older than the window) keep
  // their last dates — they'll simply fall outside any "last N months" filter.
  return {
    feedCustomers: feed.length,
    matchedContacts: matched.length,
    notInMailFoundry: feed.length - matched.length,
    swfBuyers: matched.filter((r) => r.swfOrders > 0).length,
    scsBuyers: matched.filter((r) => r.scsOrders > 0).length,
    syncedAt: now.toISOString(),
  };
}
