export const metadata = { title: "Segments" };

import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "../../src/components/app-shell";
import { prisma } from "../../src/lib/prisma";
import type { Prisma } from "../../src/generated/prisma/client";

export const dynamic = "force-dynamic";

// ── Filter helpers ────────────────────────────────────────────────────────────

type FilterParams = {
  status?:     string;  // subscribed | unsubscribed | bounced | archived | any
  country?:    string;  // GB | non-gb | any
  campaign?:   string;  // campaignId
  engagement?: string;  // sent | opened | clicked | failed | not_sent
  urlContains?: string; // substring match on click URL
};

async function buildContactWhere(f: FilterParams): Promise<Prisma.ContactWhereInput> {
  const where: Prisma.ContactWhereInput = {};

  // Status
  if (f.status === "subscribed")   { where.subscribedAt = { not: null }; where.unsubscribedAt = null; where.archivedAt = null; where.bouncedAt = null; }
  if (f.status === "unsubscribed") { where.unsubscribedAt = { not: null }; }
  if (f.status === "bounced")      { where.bouncedAt = { not: null }; }
  if (f.status === "archived")     { where.archivedAt = { not: null }; }

  // Country
  if (f.country === "gb")     { where.country = "GB"; }
  if (f.country === "non-gb") { where.country = { not: "GB" }; }

  // Campaign engagement filters
  if (f.campaign && f.engagement) {
    const campaignId = f.campaign;

    if (f.engagement === "not_sent") {
      // Contacts NOT in CampaignSend for this campaign
      where.campaignSends = { none: { campaignId } };
    } else if (f.engagement === "sent") {
      where.campaignSends = { some: { campaignId, status: "sent" } };
    } else if (f.engagement === "opened") {
      where.campaignSends = { some: { campaignId, openedAt: { not: null } } };
    } else if (f.engagement === "clicked") {
      // Has at least one click in this campaign
      where.campaignSends = {
        some: {
          campaignId,
          clicks: { some: f.urlContains ? { url: { contains: f.urlContains, mode: "insensitive" } } : {} },
        },
      };
    } else if (f.engagement === "failed") {
      where.campaignSends = { some: { campaignId, status: { startsWith: "skipped" } } };
    }
  } else if (f.urlContains) {
    // URL filter without campaign filter — any campaign
    where.campaignSends = {
      some: { clicks: { some: { url: { contains: f.urlContains, mode: "insensitive" } } } },
    };
  }

  return where;
}

// ── Page ─────────────────────────────────────────────────────────────────────

type SearchParams = Promise<{
  status?:     string;
  country?:    string;
  campaign?:   string;
  engagement?: string;
  urlContains?: string;
}>;

export default async function SegmentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;

  const filterParams: FilterParams = {
    status:      sp.status      || "any",
    country:     sp.country     || "any",
    campaign:    sp.campaign    || "",
    engagement:  sp.engagement  || "any",
    urlContains: sp.urlContains || "",
  };

  const [campaigns, where] = await Promise.all([
    prisma.campaign.findMany({
      where:   { status: { in: ["sent", "partially_sent"] } },
      orderBy: { createdAt: "desc" },
      select:  { id: true, name: true, createdAt: true },
    }),
    buildContactWhere(filterParams),
  ]);

  const hasFilters =
    filterParams.status !== "any" ||
    filterParams.country !== "any" ||
    !!filterParams.campaign ||
    !!filterParams.urlContains;

  const [total, contacts] = hasFilters
    ? await Promise.all([
        prisma.contact.count({ where }),
        prisma.contact.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take:    100,
          select: {
            id:            true,
            email:         true,
            firstName:     true,
            lastName:      true,
            country:       true,
            subscribedAt:  true,
            unsubscribedAt: true,
            bouncedAt:     true,
            archivedAt:    true,
          },
        }),
      ])
    : [0, []];

  const isFiltered = hasFilters;

  function badge(contact: typeof contacts[number]) {
    if (contact.unsubscribedAt) return { label: "Unsub",     cls: "bg-red-500/10 text-red-500" };
    if (contact.archivedAt)     return { label: "Archived",  cls: "bg-gray-100 text-gray-600" };
    if (contact.bouncedAt)      return { label: "Bounced",   cls: "bg-orange-500/10 text-orange-400" };
    if (contact.subscribedAt)   return { label: "Subscribed", cls: "bg-green-500/10 text-green-600" };
    return { label: "Unknown", cls: "bg-gray-100 text-gray-500" };
  }

  return (
    <AppShell active="segments">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Marketing</p>
          <h2 className="text-3xl font-bold">Segments</h2>
          <p className="mt-1 text-sm text-gray-500">
            Filter your audience by behaviour, status, and engagement.
          </p>
        </div>
      </header>

      {/* Filter form */}
      <form method="GET" className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6 space-y-5">
        <h3 className="font-semibold text-gray-800">Filters</h3>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Status */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Contact status</label>
            <select
              name="status"
              defaultValue={filterParams.status}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900"
            >
              <option value="any">Any status</option>
              <option value="subscribed">Subscribed</option>
              <option value="unsubscribed">Unsubscribed</option>
              <option value="bounced">Bounced</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          {/* Country */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Country</label>
            <select
              name="country"
              defaultValue={filterParams.country}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900"
            >
              <option value="any">Any country</option>
              <option value="gb">UK only (GB)</option>
              <option value="non-gb">Non-UK</option>
            </select>
          </div>

          {/* Campaign */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Campaign</label>
            <select
              name="campaign"
              defaultValue={filterParams.campaign}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900"
            >
              <option value="">Any campaign</option>
              {campaigns.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Engagement */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Engagement</label>
            <select
              name="engagement"
              defaultValue={filterParams.engagement}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900"
            >
              <option value="any">Any</option>
              <option value="sent">Sent to</option>
              <option value="opened">Opened</option>
              <option value="clicked">Clicked a link</option>
              <option value="failed">Skipped / failed</option>
              <option value="not_sent">Not yet sent</option>
            </select>
          </div>
        </div>

        {/* URL contains */}
        <div className="max-w-lg">
          <label className="block text-xs font-semibold text-gray-500 mb-1">
            Link clicked contains (optional)
          </label>
          <input
            type="text"
            name="urlContains"
            defaultValue={filterParams.urlContains}
            placeholder="e.g. /products/builders-bag or checkout"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder-gray-400"
          />
          <p className="mt-1 text-[11px] text-gray-400">
            Matches any contact who clicked a link containing this text in any (or the selected) campaign.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
          >
            Apply filters
          </button>
          <Link
            href="/segments"
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            Clear
          </Link>
        </div>
      </form>

      {/* Results */}
      {isFiltered && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">
              {total === 0 ? "No contacts match" : (
                <>
                  <span className="text-gray-900 font-bold">{total.toLocaleString()}</span>
                  {" "}contact{total !== 1 ? "s" : ""} match
                  {total > 100 ? " — showing first 100" : ""}
                </>
              )}
            </h3>

            {total > 0 && (
              <div className="flex gap-2">
                {/* Export as email list — link to contacts page with filter params pre-applied */}
                <Link
                  href={`/contacts?${new URLSearchParams(
                    Object.fromEntries(
                      Object.entries(filterParams).filter(([, v]) => v && v !== "any")
                    )
                  )}`}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                >
                  View in Contacts
                </Link>
              </div>
            )}
          </div>

          {total > 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Email</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Name</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Status</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Country</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {contacts.map(c => {
                    const b = badge(c);
                    return (
                      <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-700 font-mono text-xs">{c.email}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {[c.firstName, c.lastName].filter(Boolean).join(" ") || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${b.cls}`}>
                            {b.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{c.country || "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/contacts/${c.id}`}
                            className="text-xs text-gray-400 hover:text-gray-700 hover:underline"
                          >
                            View →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!isFiltered && (
        <div className="mt-8 rounded-2xl border border-dashed border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm">
            Apply one or more filters above to see matching contacts.
          </p>
          <p className="text-gray-300 text-xs mt-2">
            Try: status = Subscribed + Country = UK to see your deliverable UK audience.
          </p>
        </div>
      )}
    </AppShell>
  );
}
