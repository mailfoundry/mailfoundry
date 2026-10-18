/** Read models shared by the agent API (campaign view, stats, weekly summary). */
import { createHash } from "node:crypto";
import { prisma } from "./prisma";
import {
  activeApproval, campaignAudience, cohortOf, computeBrandHealth, describeDays, ELIGIBLE_CONTACT,
  finalFingerprint, largestRecentSend, preflight, ukIso, ukMidnight, DELIVERED_STATUSES,
} from "./brand-rules";

type CampaignRow = NonNullable<Awaited<ReturnType<typeof loadCampaign>>>;

export function loadCampaign(id: string) {
  return prisma.campaign.findUnique({ where: { id }, include: { list: true, brand: true } });
}

export async function campaignView(c: CampaignRow, opts: { full?: boolean; includeHtml?: boolean } = {}) {
  const [concept, final] = await Promise.all([activeApproval(c.id, "concept"), activeApproval(c.id, "final")]);
  const finalValid = !!final && final.fingerprint === finalFingerprint(c);
  const stage =
    ["scheduled", "sending", "sent", "cancelled", "blocked", "failed"].includes(c.status)
      ? c.status
      : finalValid ? "final_approved" : concept ? "concept_approved" : "draft";

  const base = {
    id: c.id,
    name: c.name,
    brand: c.brandKey,
    status: c.status,
    stage,
    subject: c.subject,
    previewText: c.preheader,
    from: c.fromEmail,
    listId: c.listId,
    listName: c.list.name,
    testList: c.list.isTest,
    group: c.cohort,
    plannedSendAt: ukIso(c.plannedSendAt),
    plannedSendAtUtc: c.plannedSendAt?.toISOString() ?? null,
    scheduledAt: ukIso(c.scheduledAt),
    createdBy: c.createdBy,
    blockedReason: c.blockedReason,
    updatedAt: c.updatedAt.toISOString(),
    approvals: {
      concept: concept ? { approvedBy: concept.approvedBy, approvedAt: concept.approvedAt.toISOString() } : null,
      final: final
        ? { approvedBy: final.approvedBy, approvedAt: final.approvedAt.toISOString(), audienceSize: final.audienceSize, sendAt: ukIso(final.sendAt), valid: finalValid }
        : null,
    },
  };
  if (!opts.full) return base;
  const check = await preflight(c.id, finalValid ? "schedule" : "approve");
  return {
    ...base,
    conceptNotes: c.conceptNotes,
    // Compact by default so responses stay small enough for ChatGPT; verify saves with htmlSha256/htmlBytes.
    ...(opts.includeHtml ? { html: c.html, text: c.body } : {}),
    htmlBytes: Buffer.byteLength(c.html ?? "", "utf8"),
    htmlSha256: c.html ? createHash("sha256").update(c.html).digest("hex") : null,
    htmlStart: (c.html ?? "").slice(0, 160),
    htmlEnd: (c.html ?? "").slice(-160),
    textBytes: Buffer.byteLength(c.body ?? "", "utf8"),
    textSha256: createHash("sha256").update(c.body ?? "").digest("hex"),
    audienceSize: check.audienceSize,
    issues: check.errors,
    warnings: check.warnings,
  };
}

export async function campaignStats(campaignId: string) {
  const [byStatus, opened, clickedSends, firstSend] = await Promise.all([
    prisma.campaignSend.groupBy({ by: ["status"], where: { campaignId }, _count: { _all: true } }),
    prisma.campaignSend.count({ where: { campaignId, openedAt: { not: null } } }),
    prisma.campaignSend.count({ where: { campaignId, clicks: { some: {} } } }),
    prisma.campaignSend.findFirst({ where: { campaignId, status: { in: DELIVERED_STATUSES } }, orderBy: { sentAt: "asc" }, select: { sentAt: true } }),
  ]);
  const n = (s: string) => byStatus.find((b) => b.status === s)?._count._all ?? 0;
  const accepted = DELIVERED_STATUSES.reduce((t, s) => t + n(s), 0);
  const unsubscribed = firstSend
    ? await prisma.campaignSend.count({
        where: { campaignId, status: { in: DELIVERED_STATUSES }, contact: { unsubscribedAt: { gte: firstSend.sentAt } } },
      })
    : 0;
  const rate = (x: number) => (accepted ? Math.round((x / accepted) * 10000) / 100 : 0);
  return {
    sent: accepted,
    delivered: accepted - n("bounced") - n("soft_bounced"),
    failed: n("failed"),
    capped: n("capped"),
    bounced: n("bounced"),
    softBounced: n("soft_bounced"),
    complained: n("complained"),
    unsubscribed,
    uniqueClicks: clickedSends,
    opens: opened,
    rates: { bounce: rate(n("bounced")), complaint: rate(n("complained")), unsubscribe: rate(unsubscribed), click: rate(clickedSends), open: rate(opened) },
    note: "Opens are unreliable (Apple Mail opens automatically) — plan from clicks.",
  };
}

/** Monday 00:00 → next Monday 00:00 (UK) for an ISO week "YYYY-Www"; default = last full week. */
export function weekRange(week?: string | null): { label: string; start: Date; end: Date } {
  let monday: Date;
  const m = week?.match(/^(\d{4})-W(\d{2})$/);
  if (m) {
    const y = Number(m[1]);
    const w = Number(m[2]);
    const jan4 = new Date(Date.UTC(y, 0, 4, 12));
    const jan4Dow = (jan4.getUTCDay() + 6) % 7; // 0 = Mon
    monday = new Date(jan4.getTime() + ((w - 1) * 7 - jan4Dow) * 86400_000);
  } else {
    const now = new Date();
    const noon = new Date(ukMidnight(now).getTime() + 12 * 3600_000);
    const dow = (noon.getUTCDay() + 6) % 7;
    monday = new Date(noon.getTime() - (dow + 7) * 86400_000);
  }
  const start = ukMidnight(new Date(monday.getTime()));
  const end = ukMidnight(new Date(monday.getTime() + 7 * 86400_000));
  // ISO week label
  const d = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const wk = Math.ceil(((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400_000 + 1) / 7);
  return { label: `${d.getUTCFullYear()}-W${String(wk).padStart(2, "0")}`, start, end };
}

export async function brandSummary(brandKey: string, range: { start: Date; end: Date }) {
  const brand = await prisma.brand.findUnique({ where: { key: brandKey } });
  if (!brand) return null;

  const sentCampaigns = await prisma.campaign.findMany({
    where: { brandKey, list: { isTest: false }, sends: { some: { sentAt: { gte: range.start, lt: range.end } } } },
    include: { list: true },
    orderBy: { updatedAt: "asc" },
  });
  const campaigns = [];
  const totals = { sent: 0, delivered: 0, bounced: 0, complained: 0, unsubscribed: 0, uniqueClicks: 0, opens: 0, capped: 0, failed: 0 };
  for (const c of sentCampaigns) {
    const s = await campaignStats(c.id);
    campaigns.push({ id: c.id, name: c.name, subject: c.subject, list: c.list.name, group: c.cohort, stats: s });
    for (const k of Object.keys(totals) as (keyof typeof totals)[]) totals[k] += s[k];
  }

  const lists = await prisma.list.findMany({ where: { brandKey }, orderBy: { name: "asc" } });
  const listSizes = [];
  for (const l of lists) {
    const audience = await campaignAudience({ listId: l.id, cohort: null });
    const groups = { A: 0, B: 0, C: 0 };
    for (const a of audience) groups[cohortOf(a.id)]++;
    listSizes.push({ id: l.id, name: l.name, testList: l.isTest, eligible: audience.length, groups });
  }

  const upcoming = await prisma.campaign.findMany({
    where: { brandKey, OR: [{ status: "scheduled" }, { status: { in: ["draft", "blocked"] }, plannedSendAt: { gte: new Date() } }] },
    include: { list: true, brand: true },
    orderBy: { plannedSendAt: "asc" },
    take: 30,
  });

  const health = await computeBrandHealth(brandKey);
  const warnings: string[] = [];
  if (brand.status !== "go") warnings.push(`${brand.name} is on ${brand.status.toUpperCase()}${brand.statusReason ? `: ${brand.statusReason}` : ""}`);
  if (!brand.postmasterUpdatedAt || Date.now() - brand.postmasterUpdatedAt.getTime() > 8 * 86400_000) {
    warnings.push("Postmaster spam rate not entered in the last 8 days");
  }
  if (!brand.agentSchedulingEnabled) warnings.push("Agent scheduling is OFF for this brand — Jason schedules approved campaigns himself");
  const blocked = await prisma.campaign.count({ where: { brandKey, status: "blocked" } });
  if (blocked) warnings.push(`${blocked} campaign(s) blocked at send time — see blockedReason`);

  return {
    brand: brand.key,
    name: brand.name,
    from: `${brand.fromName} <${brand.fromEmail}>`,
    status: brand.status,
    statusReason: brand.statusReason,
    rules: {
      maxEmailsPerContactPer7Days: brand.weeklyCapPerContact,
      maxEmailsPerContactPerDayAllBrands: 1,
      maxAudiencePerSend: brand.maxAudiencePerSend,
      sendDays: describeDays(brand.sendDays),
      sendWindowUk: `${brand.sendWindowStart}–${brand.sendWindowEnd}`,
      agentSchedulingEnabled: brand.agentSchedulingEnabled,
      holdAudienceLimit: brand.status === "hold" ? await largestRecentSend(brandKey) : null,
    },
    health,
    week: { campaigns, totals },
    lists: listSizes,
    upcoming: await Promise.all(upcoming.map((c) => campaignView(c))),
    warnings,
  };
}

export { ELIGIBLE_CONTACT };
