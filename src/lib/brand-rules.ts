/**
 * Brand rules, deliverability health, approvals fingerprint and audit log.
 * See docs/CHATGPT_INTEGRATION.md (6A + 6B).
 *
 * Campaigns whose list has no brand (brandKey null) keep the legacy behaviour.
 * Campaigns on a branded list must pass `preflight()` to be approved, scheduled or sent.
 */
import { createHash } from "node:crypto";
import type { Prisma } from "../generated/prisma/client";
import { prisma } from "./prisma";

// Send records that reached Resend (the webhook later re-labels some as bounced/complained)
export const DELIVERED_STATUSES = ["sent", "bounced", "soft_bounced", "complained"];

export const LEVELS = ["go", "hold", "stop"] as const;
export type Level = (typeof LEVELS)[number];
const worse = (a: Level, b: Level): Level => (LEVELS.indexOf(a) >= LEVELS.indexOf(b) ? a : b);

// Thresholds from the SCS handover (percent of last-7-day sends)
export const THRESHOLDS = {
  complaints:   { hold: 0.1, stop: 0.3 }, // go < 0.1 ≤ hold ≤ 0.3 < stop
  bounces:      { hold: 2, stop: 5 },
  unsubscribes: { hold: 1, stop: 2 },
  postmaster:   { hold: 0.1, stop: 0.3 }, // go < 0.1 ≤ hold < 0.3 ≤ stop
};

// ── Small helpers ───────────────────────────────────────────────────────────

/** Stable A/B/C group for a contact (same contact → same group, roughly equal thirds). */
export function cohortOf(contactId: string): "A" | "B" | "C" {
  let h = 2166136261;
  for (let i = 0; i < contactId.length; i++) {
    h ^= contactId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (["A", "B", "C"] as const)[(h >>> 0) % 3];
}

/** The bare address from "Name <addr@x>" or "addr@x". */
export function addressOf(from: string | null | undefined): string {
  const m = String(from ?? "").match(/<([^>]+)>/);
  return (m ? m[1] : String(from ?? "")).trim().toLowerCase();
}

export function brandFrom(b: { fromName: string; fromEmail: string }): string {
  return `${b.fromName} <${b.fromEmail}>`;
}

/** Weekday (1 = Mon … 7 = Sun) and "HH:MM" in UK time. */
export function ukParts(d: Date): { weekday: number; hhmm: string; ymd: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour12: false,
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value])
  );
  const weekday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(parts.weekday) + 1;
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return { weekday, hhmm: `${hour}:${parts.minute}`, ymd: `${parts.year}-${parts.month}-${parts.day}` };
}

/** Start of the current UK calendar day, as a UTC Date (DST-safe). */
export function ukMidnight(now = new Date()): Date {
  const { ymd } = ukParts(now);
  const [y, m, d] = ymd.split("-").map(Number);
  for (const offsetH of [0, 1]) {
    const c = new Date(Date.UTC(y, m - 1, d, 0, 0) - offsetH * 3600_000);
    const p = ukParts(c);
    if (p.ymd === ymd && p.hhmm === "00:00") return c;
  }
  return new Date(Date.UTC(y, m - 1, d));
}

const DAY_NAMES = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const describeDays = (sendDays: string) =>
  sendDays.split(",").map((d) => DAY_NAMES[Number(d)] ?? d).join("/");

// ── Audit log ───────────────────────────────────────────────────────────────

export async function audit(
  actor: string,
  action: string,
  opts: { campaignId?: string | null; brandKey?: string | null; detail?: Prisma.InputJsonValue } = {}
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: { actor, action, campaignId: opts.campaignId ?? null, brandKey: opts.brandKey ?? null, detail: opts.detail },
    });
  } catch (err) {
    console.error("[audit] failed to write", action, err); // never block the action on logging
  }
}

// ── Deliverability health ───────────────────────────────────────────────────

export type BrandHealth = {
  windowDays: number;
  sends: number;
  complaints: number;
  bounces: number;
  unsubscribes: number;
  complaintRate: number;
  bounceRate: number;
  unsubscribeRate: number;
  postmasterSpamRate: number | null;
  recommended: Level;
  reasons: string[];
};

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 10000) / 100 : 0);

function grade(value: number, t: { hold: number; stop: number }, inclusiveStop: boolean): Level {
  if (inclusiveStop ? value >= t.stop : value > t.stop) return "stop";
  if (value >= t.hold) return "hold";
  return "go";
}

export async function computeBrandHealth(brandKey: string, windowDays = 7): Promise<BrandHealth> {
  const since = new Date(Date.now() - windowDays * 86400_000);
  const base: Prisma.CampaignSendWhereInput = {
    sentAt: { gte: since },
    campaign: { brandKey, list: { isTest: false } },
  };
  const [sends, complaints, bounces, unsubscribes, brand] = await Promise.all([
    prisma.campaignSend.count({ where: { ...base, status: { in: DELIVERED_STATUSES } } }),
    prisma.campaignSend.count({ where: { ...base, status: "complained" } }),
    prisma.campaignSend.count({ where: { ...base, status: "bounced" } }),
    prisma.campaignSend.count({
      where: { ...base, status: { in: DELIVERED_STATUSES }, contact: { unsubscribedAt: { gte: since } } },
    }),
    prisma.brand.findUnique({ where: { key: brandKey } }),
  ]);

  const complaintRate = pct(complaints, sends);
  const bounceRate = pct(bounces, sends);
  const unsubscribeRate = pct(unsubscribes, sends);
  const pmFresh =
    brand?.postmasterSpamRate != null &&
    brand.postmasterUpdatedAt != null &&
    Date.now() - brand.postmasterUpdatedAt.getTime() < 14 * 86400_000;
  const postmasterSpamRate = pmFresh ? brand!.postmasterSpamRate! : null;

  let recommended: Level = "go";
  const reasons: string[] = [];
  const check = (label: string, value: number, t: { hold: number; stop: number }, inclusiveStop: boolean) => {
    const g = grade(value, t, inclusiveStop);
    if (g !== "go") reasons.push(`${label} ${value}% (${g})`);
    recommended = worse(recommended, g);
  };
  if (sends > 0) {
    check("complaints", complaintRate, THRESHOLDS.complaints, false);
    check("bounces", bounceRate, THRESHOLDS.bounces, false);
    check("unsubscribes", unsubscribeRate, THRESHOLDS.unsubscribes, false);
  }
  if (postmasterSpamRate != null) check("Postmaster spam rate", postmasterSpamRate, THRESHOLDS.postmaster, true);

  return { windowDays, sends, complaints, bounces, unsubscribes, complaintRate, bounceRate, unsubscribeRate, postmasterSpamRate, recommended, reasons };
}

/**
 * Re-grade a brand. Escalates automatically (go → hold → stop) but never relaxes —
 * only Jason can move a brand back to a lower level (Settings → Brands).
 */
export async function refreshBrandStatus(brandKey: string) {
  const brand = await prisma.brand.findUnique({ where: { key: brandKey } });
  if (!brand) return null;
  const health = await computeBrandHealth(brandKey);
  const current = (LEVELS.includes(brand.status as Level) ? brand.status : "stop") as Level;
  if (worse(current, health.recommended) !== current) {
    const reason = `auto: ${health.reasons.join(", ")}`;
    const updated = await prisma.brand.update({
      where: { key: brandKey },
      data: { status: health.recommended, statusReason: reason, statusSetBy: "system", statusSetAt: new Date() },
    });
    await audit("system", "brand_status_auto", { brandKey, detail: { from: current, to: health.recommended, reason } });
    return { brand: updated, health };
  }
  return { brand, health };
}

// ── Audience ────────────────────────────────────────────────────────────────

export const ELIGIBLE_CONTACT = {
  subscribedAt: { not: null },
  unsubscribedAt: null,
  archivedAt: null,
  bouncedAt: null,
  complainedAt: null,
} satisfies Prisma.ContactWhereInput;

/** Ids + emails of contacts this campaign would target (suppression + cohort applied, caps not applied). */
export async function campaignAudience(c: { listId: string; cohort: string | null }) {
  const rows = await prisma.contactList.findMany({
    where: { listId: c.listId, contact: ELIGIBLE_CONTACT },
    select: { contact: { select: { id: true, email: true, firstName: true, lastName: true } } },
  });
  const contacts = rows.map((r) => r.contact);
  return c.cohort ? contacts.filter((x) => cohortOf(x.id) === c.cohort) : contacts;
}

/** Largest single non-test send for the brand in the last 7 days (used by Hold). */
export async function largestRecentSend(brandKey: string): Promise<number> {
  const since = new Date(Date.now() - 7 * 86400_000);
  const groups = await prisma.campaignSend.groupBy({
    by: ["campaignId"],
    where: { sentAt: { gte: since }, status: { in: DELIVERED_STATUSES }, campaign: { brandKey, list: { isTest: false } } },
    _count: { _all: true },
  });
  return groups.reduce((m, g) => Math.max(m, g._count._all), 0);
}

// ── Fingerprints + approvals ────────────────────────────────────────────────

type FingerprintFields = {
  brandKey: string | null;
  listId: string;
  cohort: string | null;
  fromEmail: string | null;
  subject: string;
  preheader: string | null;
  html: string | null;
  body: string;
  plannedSendAt: Date | null;
};

/** Hash of everything a final approval covers: content, sender, audience and send time. */
export function finalFingerprint(c: FingerprintFields): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        c.brandKey, c.listId, c.cohort ?? "", c.fromEmail ?? "", c.subject, c.preheader ?? "",
        c.html ?? "", c.body, c.plannedSendAt ? c.plannedSendAt.toISOString() : "",
      ])
    )
    .digest("hex");
}

export function conceptFingerprint(c: { brandKey: string | null; subject: string; conceptNotes: string | null; plannedSendAt: Date | null }): string {
  return createHash("sha256")
    .update(JSON.stringify([c.brandKey, c.subject, c.conceptNotes ?? "", c.plannedSendAt ? c.plannedSendAt.toISOString() : ""]))
    .digest("hex");
}

export async function activeApproval(campaignId: string, kind: "concept" | "final") {
  return prisma.campaignApproval.findFirst({
    where: { campaignId, kind, revokedAt: null },
    orderBy: { approvedAt: "desc" },
  });
}

/** Revoke a final approval whose fingerprint no longer matches; unschedule if needed. Returns true if revoked. */
export async function invalidateIfChanged(campaignId: string, actor: string): Promise<boolean> {
  const c = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!c) return false;
  const approval = await activeApproval(campaignId, "final");
  if (!approval || approval.fingerprint === finalFingerprint(c)) return false;
  await prisma.campaignApproval.update({
    where: { id: approval.id },
    data: { revokedAt: new Date(), revokedReason: "campaign changed after approval" },
  });
  if (c.status === "scheduled" || c.status === "blocked") {
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: "draft", scheduledAt: null } });
  }
  await audit(actor, "final_approval_invalidated", { campaignId, brandKey: c.brandKey, detail: { reason: "changed after approval" } });
  return true;
}

// ── Preflight ───────────────────────────────────────────────────────────────

export type Phase = "approve" | "schedule" | "send";

export type Preflight = {
  ok: boolean;
  branded: boolean;
  errors: string[];
  warnings: string[];
  audienceSize: number;
  brandStatus?: string;
};

const BARE_FIRSTNAME = /\{\{\s*firstName\s*\}\}/; // must use {{firstName|fallback}}

/**
 * Every rule a branded campaign must pass. "approve" checks everything except the approval itself;
 * "schedule" and "send" also require a matching final approval.
 */
export async function preflight(campaignId: string, phase: Phase, now = new Date()): Promise<Preflight> {
  const c = await prisma.campaign.findUnique({ where: { id: campaignId }, include: { list: true, brand: true } });
  if (!c) return { ok: false, branded: false, errors: ["Campaign not found"], warnings: [], audienceSize: 0 };

  const errors: string[] = [];
  const warnings: string[] = [];
  const audience = await campaignAudience(c);
  const audienceSize = audience.length;

  if (!c.brandKey) {
    if (c.list.brandKey) errors.push(`List "${c.list.name}" belongs to ${c.list.brandKey.toUpperCase()} — re-save the campaign so brand rules apply`);
    return { ok: errors.length === 0, branded: false, errors, warnings, audienceSize };
  }

  const brand = c.brand;
  if (!brand) return { ok: false, branded: true, errors: [`Unknown brand ${c.brandKey}`], warnings, audienceSize };
  const isTest = c.list.isTest;

  // Identity + audience
  if (c.list.brandKey !== c.brandKey) errors.push(`List "${c.list.name}" is not a ${brand.name} list`);
  if (addressOf(c.fromEmail) !== brand.fromEmail.toLowerCase()) errors.push(`From must be ${brandFrom(brand)}`);
  if (c.cohort && !["A", "B", "C"].includes(c.cohort)) errors.push("Group must be A, B, C or blank");
  if (audienceSize === 0) errors.push("No eligible contacts in this audience");

  // Content rules
  if (!c.subject.trim()) errors.push("Subject is empty");
  if (!c.body.trim()) errors.push("Plain-text body is empty");
  if (BARE_FIRSTNAME.test(c.subject) || BARE_FIRSTNAME.test(c.body) || BARE_FIRSTNAME.test(c.html ?? "") || BARE_FIRSTNAME.test(c.preheader ?? "")) {
    errors.push("Use {{firstName|there}} — a bare {{firstName}} shows \"Hi ,\" to contacts with no name");
  }
  if (!c.preheader?.trim()) warnings.push("No preview text");

  // Brand status + ramp (test lists only reach Jason's own addresses, so these don't apply)
  if (!isTest) {
    if (brand.status === "stop") errors.push(`${brand.name} is on STOP${brand.statusReason ? ` (${brand.statusReason})` : ""} — no sending until Jason clears it`);
    if (brand.status === "hold") {
      const prev = await largestRecentSend(brand.key);
      if (prev === 0) errors.push(`${brand.name} is on HOLD and has no send in the last 7 days to hold at`);
      else if (audienceSize > prev) errors.push(`${brand.name} is on HOLD — audience ${audienceSize} is larger than last week's largest send (${prev})`);
    }
    if (brand.maxAudiencePerSend != null && audienceSize > brand.maxAudiencePerSend) {
      errors.push(`Audience ${audienceSize} is over the ${brand.name} ramp cap of ${brand.maxAudiencePerSend} per send`);
    }
  }

  // Send time
  const sendAt = c.plannedSendAt;
  if (!sendAt) {
    errors.push("No planned send time");
  } else if (phase !== "send") {
    if (sendAt.getTime() < now.getTime() + 5 * 60_000) errors.push("Planned send time must be at least 5 minutes in the future");
    if (!isTest) {
      const { weekday, hhmm } = ukParts(sendAt);
      const days = brand.sendDays.split(",").map(Number);
      if (!days.includes(weekday)) errors.push(`${brand.name} sends only on ${describeDays(brand.sendDays)} (UK)`);
      if (hhmm < brand.sendWindowStart || hhmm > brand.sendWindowEnd) {
        errors.push(`${brand.name} sends only between ${brand.sendWindowStart} and ${brand.sendWindowEnd} UK time`);
      }
    }
  }

  // Approval
  if (phase !== "approve") {
    const approval = await activeApproval(c.id, "final");
    if (!approval) {
      errors.push("final_approval_required: Jason has not given final approval");
    } else if (approval.fingerprint !== finalFingerprint(c)) {
      errors.push("final_approval_stale: the campaign changed after final approval — needs re-approval");
    } else if (approval.audienceSize != null && audienceSize > approval.audienceSize) {
      errors.push(`audience_grew: audience is now ${audienceSize}, approved for ${approval.audienceSize} — needs re-approval`);
    }
  }

  return { ok: errors.length === 0, branded: true, errors, warnings, audienceSize, brandStatus: brand.status };
}

// ── Frequency caps (applied per contact at send time) ───────────────────────

/**
 * Returns contact ids that must be skipped for this brand right now:
 *  - already at the brand's weekly cap (rolling 7 days), or
 *  - already sent any branded marketing email today (UK), either brand.
 */
export async function cappedContacts(brandKey: string, weeklyCap: number, contactIds: string[], now = new Date()) {
  const capped = new Map<string, string>();
  if (contactIds.length === 0) return capped;
  const weekAgo = new Date(now.getTime() - 7 * 86400_000);
  const today = ukMidnight(now);

  for (let i = 0; i < contactIds.length; i += 5000) {
    const chunk = contactIds.slice(i, i + 5000);
    const recent = await prisma.campaignSend.findMany({
      where: {
        contactId: { in: chunk },
        sentAt: { gte: weekAgo },
        status: { in: DELIVERED_STATUSES },
        campaign: { brandKey: { not: null }, list: { isTest: false } },
      },
      select: { contactId: true, sentAt: true, campaign: { select: { brandKey: true } } },
    });
    const weekCount = new Map<string, number>();
    for (const r of recent) {
      if (!r.contactId) continue;
      if (r.sentAt >= today) capped.set(r.contactId, "daily_cap: already emailed today");
      if (r.campaign.brandKey === brandKey) weekCount.set(r.contactId, (weekCount.get(r.contactId) ?? 0) + 1);
    }
    for (const [id, n] of weekCount) {
      if (n >= weeklyCap && !capped.has(id)) capped.set(id, `weekly_cap: ${n} in last 7 days`);
    }
  }
  return capped;
}

/** Parse "2026-10-27T10:00" (UK local) or a full ISO string with offset/Z. Returns null if invalid. */
export function parseUkDateTime(raw: unknown): Date | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  if (/(Z|[+-]\d\d:?\d\d)$/i.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number) as unknown as number[];
  for (const offsetH of [0, 1]) {
    const c = new Date(Date.UTC(y, mo - 1, d, h, mi) - offsetH * 3600_000);
    const p = ukParts(c);
    if (p.ymd === `${m[1]}-${m[2]}-${m[3]}` && p.hhmm === `${m[4]}:${m[5]}`) return c;
  }
  return null;
}

/** "2026-10-27T10:00:00 (UK)" style string for API responses. */
export function ukIso(d: Date | null | undefined): string | null {
  if (!d) return null;
  const p = ukParts(d);
  return `${p.ymd}T${p.hhmm} Europe/London`;
}
