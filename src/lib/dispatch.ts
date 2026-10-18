/**
 * The one place campaigns are actually sent (used by "Send Campaign" and the scheduled-send cron).
 * Branded campaigns must pass preflight("send") — approval, Hold/Stop, ramp cap — and per-contact
 * frequency caps are applied here, at the moment of sending.
 */
import { prisma } from "./prisma";
import { addEmailFooter, addPreheader } from "./emailFooter";
import { applyMergeTags } from "./merge";
import { listUnsubscribeHeaders } from "./unsubscribe";
import { audit, campaignAudience, cappedContacts, preflight, refreshBrandStatus } from "./brand-rules";

const DEFAULT_FROM = "IBSA · Xylo Supplies <noreply@xylouk.co.uk>";
const BATCH_SIZE = 100; // Resend batch limit

export type DispatchResult = {
  ok: boolean;
  sent: number;
  failed: number;
  capped: number;
  skippedAlreadySent: number;
  error?: string;
  blocked?: string[];
};

export async function dispatchCampaign(campaignId: string, actor: string): Promise<DispatchResult> {
  const empty = { sent: 0, failed: 0, capped: 0, skippedAlreadySent: 0 };
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, ...empty, error: "RESEND_API_KEY not set" };

  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId }, include: { brand: true, list: true } });
  if (!campaign) return { ok: false, ...empty, error: "Campaign not found" };
  if (campaign.status === "cancelled") return { ok: false, ...empty, error: "Campaign is cancelled" };
  if (!campaign.fromEmail) return { ok: false, ...empty, error: "No FROM address set" };

  // ── Brand rules ───────────────────────────────────────────────────────────
  if (campaign.brandKey || campaign.list.brandKey) {
    if (campaign.brandKey) await refreshBrandStatus(campaign.brandKey); // escalate to Hold/Stop first if last week's numbers say so
    const pf = await preflight(campaign.id, "send");
    if (!pf.ok) {
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: "blocked", scheduledAt: null, blockedReason: pf.errors.join(" · ").slice(0, 1000) },
      });
      await audit(actor, "send_blocked", { campaignId: campaign.id, brandKey: campaign.brandKey, detail: { errors: pf.errors } });
      return { ok: false, ...empty, error: "Blocked by brand rules", blocked: pf.errors };
    }
  }

  const audience = await campaignAudience(campaign);
  if (audience.length === 0) return { ok: false, ...empty, error: "No eligible contacts found in this campaign list." };

  // Dedup: anyone this campaign already reached
  const already = new Set(
    (
      await prisma.campaignSend.findMany({
        where: { campaignId, status: { in: ["sent", "bounced", "soft_bounced", "complained"] } },
        select: { email: true },
      })
    ).map((r) => r.email)
  );
  let toSend = audience.filter((c) => !already.has(c.email));
  const skippedAlreadySent = audience.length - toSend.length;

  // Frequency caps (not for test lists, which only hold Jason's own addresses)
  const cappedRecords: { campaignId: string; contactId: string; email: string; status: string; error: string }[] = [];
  if (campaign.brand && !campaign.list.isTest) {
    const capped = await cappedContacts(campaign.brand.key, campaign.brand.weeklyCapPerContact, toSend.map((c) => c.id));
    toSend = toSend.filter((c) => {
      const why = capped.get(c.id);
      if (why) cappedRecords.push({ campaignId, contactId: c.id, email: c.email, status: "capped", error: why });
      return !why;
    });
  }

  if (toSend.length === 0) {
    if (cappedRecords.length) await prisma.campaignSend.createMany({ data: cappedRecords });
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: "sent", scheduledAt: null, blockedReason: null } });
    return { ok: true, ...empty, capped: cappedRecords.length, skippedAlreadySent };
  }

  await prisma.campaign.update({ where: { id: campaignId }, data: { status: "sending", scheduledAt: null, blockedReason: null } });
  await audit(actor, "send_started", { campaignId, brandKey: campaign.brandKey, detail: { recipients: toSend.length, capped: cappedRecords.length } });

  const appBaseUrl = process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "https://ibsa.xylouk.co.uk";
  const baseHtml = campaign.html?.trim()
    ? campaign.html
    : `<div style="font-family:Arial,sans-serif;line-height:1.6">${campaign.body.replace(/\n/g, "<br/>")}</div>`;

  const payloads = toSend.map((contact) => {
    const sendId = crypto.randomUUID();
    // Merge tags ({{firstName|there}} etc.) are filled per contact before footer/tracking are added
    const htmlWithFooter = addPreheader(
      addEmailFooter(applyMergeTags(baseHtml, contact, { html: true }), contact.email, campaign.fromEmail),
      campaign.preheader ? applyMergeTags(campaign.preheader, contact, { html: true }) : campaign.preheader
    );
    const htmlWithClicks = htmlWithFooter.replace(
      /<a\s+([^>]*?)href="(https?:\/\/[^"]+)"([^>]*?)>/gi,
      (_m, pre, url, post) => `<a ${pre}href="${appBaseUrl}/api/track/click?s=${sendId}&u=${encodeURIComponent(url)}"${post}>`
    );
    const pixel = `<img src="${appBaseUrl}/api/track/open?s=${sendId}" width="1" height="1" style="display:none" alt="" />`;
    const html = htmlWithClicks.includes("</body>") ? htmlWithClicks.replace("</body>", `${pixel}</body>`) : `${htmlWithClicks}${pixel}`;
    return {
      sendId,
      contactId: contact.id,
      email: contact.email,
      resendPayload: {
        from: campaign.fromEmail ?? DEFAULT_FROM,
        to: contact.email,
        subject: applyMergeTags(campaign.subject, contact),
        text: applyMergeTags(campaign.body, contact),
        html,
        headers: listUnsubscribeHeaders(contact.email), // one-click unsubscribe
        tags: [{ name: "send_id", value: sendId }], // lets the Resend webhook tie bounces/complaints back
      },
    };
  });

  const records: { id?: string; campaignId: string; contactId: string; email: string; status: string; error?: string }[] = [];
  for (let i = 0; i < payloads.length; i += BATCH_SIZE) {
    const chunk = payloads.slice(i, i + BATCH_SIZE);
    try {
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(chunk.map((p) => p.resendPayload)),
      });
      if (res.ok) {
        for (const p of chunk) records.push({ id: p.sendId, campaignId, contactId: p.contactId, email: p.email, status: "sent" });
      } else {
        const errBody = await res.text().catch(() => "unknown");
        for (const p of chunk) {
          records.push({ campaignId, contactId: p.contactId, email: p.email, status: "failed", error: `Batch error ${res.status}: ${errBody}`.slice(0, 200) });
        }
      }
    } catch (err) {
      const msg = (err instanceof Error ? err.message : String(err)).slice(0, 200);
      for (const p of chunk) records.push({ campaignId, contactId: p.contactId, email: p.email, status: "failed", error: msg });
    }
  }

  await prisma.campaignSend.createMany({ data: [...records, ...cappedRecords] });
  const sent = records.filter((r) => r.status === "sent").length;
  const failed = records.length - sent;

  await prisma.campaign.update({ where: { id: campaignId }, data: { status: sent > 0 ? "sent" : "failed", scheduledAt: null } });
  await audit(actor, "send_finished", { campaignId, brandKey: campaign.brandKey, detail: { sent, failed, capped: cappedRecords.length } });

  return { ok: true, sent, failed, capped: cappedRecords.length, skippedAlreadySent };
}
