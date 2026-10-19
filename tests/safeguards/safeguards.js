process.env.RESEND_API_KEY = "test";
const { prisma, __db: db, __reset } = require("./out/lib/prisma.js");
const R = require("./out/lib/brand-rules.js");
const { dispatchCampaign } = require("./out/lib/dispatch.js");
const { createCampaignRecord, updateCampaignRecord } = require("./out/lib/campaign-save.js");

let pass = 0, fail = 0;
const t = (name, cond, extra) => { if (cond) pass++; else { fail++; console.log("FAIL:", name, extra ?? ""); } };
const has = (pf, s) => pf.errors.some((e) => e.includes(s));

// Fake Resend: record every recipient actually sent to
let resendCalls = [];
global.fetch = async (url, opts) => { const body = JSON.parse(opts.body); resendCalls.push(...body.map((p) => p.to)); return { ok: true, text: async () => "" }; };

const NOW = new Date();
const TUE_10 = R.parseUkDateTime("2026-10-27T10:00"); // Tuesday, GMT
const MON_10 = R.parseUkDateTime("2026-10-26T10:00");
const TUE_12 = R.parseUkDateTime("2026-10-27T12:00");
const SENT = new Date("2026-10-20T09:00:00Z");

async function seed() {
  __reset(); resendCalls = [];
  db.brand.push(
    { key: "scs", name: "Staffordshire Cleaning Supplies", fromName: "Staffordshire Cleaning Supplies", fromEmail: "info@staffordshirecleaningsupplies.co.uk", status: "go", statusReason: null, weeklyCapPerContact: 1, maxAudiencePerSend: null, sendDays: "2,3,4", sendWindowStart: "10:00", sendWindowEnd: "11:00", agentSchedulingEnabled: false, postmasterSpamRate: null, postmasterUpdatedAt: null },
    { key: "swf", name: "Staffordshire Wood Fuels", fromName: "Staffordshire Wood Fuels", fromEmail: "info@staffordshirewoodfuels.co.uk", status: "go", statusReason: null, weeklyCapPerContact: 1, maxAudiencePerSend: null, sendDays: "2,4", sendWindowStart: "10:00", sendWindowEnd: "11:00", agentSchedulingEnabled: false, postmasterSpamRate: null, postmasterUpdatedAt: null },
  );
  db.list.push({ id: "warm", name: "SCS Warm-up", brandKey: "scs", isTest: false }, { id: "swfl", name: "SWF Engaged", brandKey: "swf", isTest: false }, { id: "test", name: "Agent Test", brandKey: "scs", isTest: true }, { id: "legacy", name: "Old list", brandKey: null, isTest: false });
  const ok = { subscribedAt: new Date(2025, 1, 1), unsubscribedAt: null, archivedAt: null, bouncedAt: null, complainedAt: null, firstName: null, lastName: null };
  for (let i = 0; i < 30; i++) { db.contact.push({ id: "c" + i, email: `c${i}@x.com`, ...ok }); db.contactList.push({ id: "cl" + i, contactId: "c" + i, listId: "warm" }); }
  // suppressed contacts on the warm-up list
  db.contact.push({ id: "unsub", email: "unsub@x.com", ...ok, unsubscribedAt: new Date() }, { id: "bounce", email: "bounce@x.com", ...ok, bouncedAt: new Date() }, { id: "compl", email: "compl@x.com", ...ok, complainedAt: new Date() });
  for (const s of ["unsub", "bounce", "compl"]) db.contactList.push({ id: "cl" + s, contactId: s, listId: "warm" });
  db.contact.push({ id: "jason", email: "jason@me.com", ...ok }); db.contactList.push({ id: "clj", contactId: "jason", listId: "test" });
}

async function newCampaign(over = {}) {
  const c0 = await createCampaignRecord({ name: "T", subject: "Floor care tips", preheader: "Save on dilution", fromEmail: "Someone <spoof@evil.com>", body: "Hi {{firstName|there}},\nText", html: "<p>Hi {{firstName|there}},</p>", listId: "warm", cohort: null, sendAt: TUE_10, ...over }, "agent:test");
  await R.recordTestSend(c0.id);
  return db.campaign.find((x) => x.id === c0.id);
}
async function approve(id) {
  const c = db.campaign.find((x) => x.id === id);
  const pf = await R.preflight(id, "approve", NOW);
  db.campaignApproval.push({ id: "ap" + Math.random(), campaignId: id, kind: "final", fingerprint: R.finalFingerprint(c), audienceSize: pf.audienceSize, sendAt: c.plannedSendAt, approvedBy: "jason", approvedAt: new Date(), revokedAt: null });
}

(async () => {
  // ── Identity, approval and content ─────────────────────────────────────
  await seed();
  let c = await newCampaign();
  t("brand set from list", c.brandKey === "scs");
  t("From forced to brand (spoof ignored)", c.fromEmail === "Staffordshire Cleaning Supplies <info@staffordshirecleaningsupplies.co.uk>");
  t("branded campaign saved as draft, not scheduled", c.status === "draft" && c.scheduledAt === null);
  let pf = await R.preflight(c.id, "approve", NOW);
  t("suppressed contacts excluded from audience", pf.audienceSize === 30, pf.audienceSize);
  t("approve-phase passes", pf.ok, pf.errors);
  pf = await R.preflight(c.id, "schedule", NOW);
  t("schedule blocked without final approval", !pf.ok && has(pf, "final_approval_required"));
  await approve(c.id);
  pf = await R.preflight(c.id, "schedule", NOW);
  t("schedule allowed after approval", pf.ok, pf.errors);

  await updateCampaignRecord(c.id, { name: "T", subject: "Changed subject", preheader: "Save on dilution", fromEmail: null, body: c.body, html: c.html, listId: "warm", cohort: null, sendAt: undefined }, "agent:test");
  t("edit after approval revokes it", db.campaignApproval.every((a) => a.revokedAt));
  pf = await R.preflight(c.id, "schedule", NOW);
  t("schedule blocked after edit", !pf.ok && has(pf, "final_approval_required"));

  await approve(c.id);
  db.campaign.find((x) => x.id === c.id).html = "<p>sneaky change</p>"; // change behind the app's back
  pf = await R.preflight(c.id, "send", NOW);
  t("send-time fingerprint check catches direct DB edits", !pf.ok && has(pf, "final_approval_stale"));

  // audience growth after approval
  await seed(); c = await newCampaign(); await approve(c.id);
  db.contact.push({ id: "new1", email: "new1@x.com", subscribedAt: new Date(), unsubscribedAt: null, archivedAt: null, bouncedAt: null, complainedAt: null });
  db.contactList.push({ id: "cln", contactId: "new1", listId: "warm" });
  pf = await R.preflight(c.id, "send", NOW);
  t("audience growth after approval blocks", !pf.ok && has(pf, "audience_grew"));

  // content rule
  await seed(); c = await newCampaign({ html: "<p>Hi {{firstName}},</p>" });
  pf = await R.preflight(c.id, "approve", NOW);
  t("bare {{firstName}} rejected", !pf.ok && has(pf, "firstName|there"));

  // send days / window
  await seed(); c = await newCampaign({ sendAt: MON_10 });
  t("Monday rejected for SCS", has(await R.preflight(c.id, "approve", NOW), "sends only on Tue/Wed/Thu"));
  c = await newCampaign({ sendAt: TUE_12 });
  t("12:00 rejected (window 10–11)", has(await R.preflight(c.id, "approve", NOW), "between 10:00 and 11:00"));

  // wrong-brand list via API rule
  let threw = false;
  try { await createCampaignRecord({ name: "x", subject: "s", preheader: null, fromEmail: null, body: "b", html: null, listId: "swfl", cohort: null, sendAt: TUE_10 }, "agent:test", { requireBrand: "scs" }); } catch { threw = true; }
  t("agent can't put an SCS campaign on an SWF list", threw);
  threw = false;
  try { await createCampaignRecord({ name: "x", subject: "s", preheader: null, fromEmail: null, body: "b", html: null, listId: "legacy", cohort: null, sendAt: TUE_10 }, "agent:test", { requireBrand: "scs" }); } catch { threw = true; }
  t("agent can't use an unassigned list", threw);

  // ramp cap + cohorts
  await seed(); db.brand[0].maxAudiencePerSend = 12;
  c = await newCampaign();
  t("ramp cap blocks 30 > 12", has(await R.preflight(c.id, "approve", NOW), "ramp cap"));
  c = await newCampaign({ cohort: "A" });
  pf = await R.preflight(c.id, "approve", NOW);
  t(`group A is about a third (${pf.audienceSize})`, pf.audienceSize >= 5 && pf.audienceSize <= 15);

  // Stop / Hold
  await seed(); db.brand[0].status = "stop"; c = await newCampaign();
  t("STOP blocks", has(await R.preflight(c.id, "approve", NOW), "STOP"));
  db.brand[0].status = "hold";
  t("HOLD with no recent send blocks", has(await R.preflight(c.id, "approve", NOW), "HOLD"));
  const prev = await newCampaign();
  for (let i = 0; i < 10; i++) db.campaignSend.push({ id: "p" + i, campaignId: prev.id, contactId: "c" + i, email: `c${i}@x.com`, status: "sent", sentAt: new Date(Date.now() - 2 * 86400_000) });
  t("HOLD blocks audience 30 > last week's 10", has(await R.preflight(c.id, "approve", NOW), "larger than last week"));

  // Test list ignores ramp/hold but still needs approval
  db.brand[0].status = "stop";
  c = await newCampaign({ listId: "test" });
  pf = await R.preflight(c.id, "approve", NOW);
  t("test list not blocked by STOP", pf.ok, pf.errors);
  t("test list still needs final approval to schedule", has(await R.preflight(c.id, "schedule", NOW), "final_approval_required"));

  // ── Health auto-escalation ────────────────────────────────────────────
  await seed();
  const h = await newCampaign();
  for (let i = 0; i < 1000; i++) db.campaignSend.push({ id: "h" + i, campaignId: h.id, contactId: "c" + (i % 30), email: "x", status: i < 2 ? "complained" : "sent", sentAt: new Date(Date.now() - 86400_000) });
  let res = await R.refreshBrandStatus("scs");
  t("2 complaints / 1000 = 0.2% → HOLD", res.brand.status === "hold", res.health);
  for (let i = 0; i < 3; i++) db.campaignSend.find((s) => s.id === "h" + (10 + i)).status = "complained";
  res = await R.refreshBrandStatus("scs");
  t("5 / 1000 = 0.5% → STOP", res.brand.status === "stop");
  db.campaignSend.forEach((s) => (s.status = "sent"));
  res = await R.refreshBrandStatus("scs");
  t("never auto-relaxes from STOP", res.brand.status === "stop");
  db.brand[0].status = "go"; db.brand[0].postmasterSpamRate = 0.3; db.brand[0].postmasterUpdatedAt = new Date();
  res = await R.refreshBrandStatus("scs");
  t("Postmaster 0.3% → STOP", res.brand.status === "stop");

  // ── Frequency caps ───────────────────────────────────────────────────
  await seed();
  const old = await newCampaign();
  const swfOld = await createCampaignRecord({ name: "w", subject: "s", preheader: null, fromEmail: null, body: "b", html: null, listId: "swfl", cohort: null, sendAt: TUE_10 }, "jason");
  db.campaignSend.push(
    { id: "s1", campaignId: old.id, contactId: "c1", email: "c1@x.com", status: "sent", sentAt: new Date(Date.now() - 3 * 86400_000) },   // SCS 3 days ago → weekly cap
    { id: "s2", campaignId: swfOld.id, contactId: "c2", email: "c2@x.com", status: "sent", sentAt: R.ukMidnight(new Date(Date.now())) }, // SWF today → daily cap (cross-brand)
    { id: "s3", campaignId: swfOld.id, contactId: "c3", email: "c3@x.com", status: "sent", sentAt: new Date(Date.now() - 2 * 86400_000) }, // SWF 2 days ago → OK for SCS
    { id: "s4", campaignId: old.id, contactId: "c4", email: "c4@x.com", status: "complained", sentAt: new Date(Date.now() - 2 * 86400_000) }, // counts as delivered
  );
  const capped = await R.cappedContacts("scs", 1, ["c1", "c2", "c3", "c4", "c5"]);
  t("weekly cap (SCS 3 days ago)", capped.get("c1")?.startsWith("weekly_cap"));
  t("daily cap across brands (SWF today)", capped.get("c2")?.startsWith("daily_cap"));
  t("other brand's earlier send doesn't use SCS weekly cap", !capped.has("c3"));
  t("complained send still counts towards cap", capped.has("c4"));
  t("fresh contact not capped", !capped.has("c5"));

  // ── Dispatch end-to-end (fake Resend) ────────────────────────────────
  await seed();
  c = await newCampaign();
  db.campaign.find((x) => x.id === c.id).status = "scheduled";
  let d = await dispatchCampaign(c.id, "system:cron");
  t("dispatch refuses unapproved campaign", !d.ok && d.blocked && resendCalls.length === 0);
  t("…and marks it blocked with a reason", db.campaign.find((x) => x.id === c.id).status === "blocked" && /final_approval/.test(db.campaign.find((x) => x.id === c.id).blockedReason));

  await seed();
  const prior = await newCampaign();
  db.campaignSend.push({ id: "pp", campaignId: prior.id, contactId: "c7", email: "c7@x.com", status: "sent", sentAt: new Date(Date.now() - 86400_000) });
  c = await newCampaign(); await approve(c.id);
  d = await dispatchCampaign(c.id, "system:cron");
  t("approved campaign sends", d.ok && d.sent === 29, d);
  t("capped contact recorded, not emailed", d.capped === 1 && !resendCalls.includes("c7@x.com") && db.campaignSend.some((s) => s.status === "capped" && s.contactId === "c7"));
  t("suppressed contacts never emailed", !resendCalls.some((e) => ["unsub@x.com", "bounce@x.com", "compl@x.com"].includes(e)));
  t("test-list contact not emailed by a warm-up send", !resendCalls.includes("jason@me.com"));
  const sentCount = resendCalls.length;
  d = await dispatchCampaign(c.id, "jason");
  t("re-dispatch doesn't double-send", resendCalls.length === sentCount);

  // cohort send only hits its group
  await seed(); c = await newCampaign({ cohort: "B" }); await approve(c.id);
  d = await dispatchCampaign(c.id, "system:cron");
  t("group B send only emails group B", resendCalls.every((e) => R.cohortOf(e.split("@")[0]) === "B") && resendCalls.length === d.sent);

  // unbranded campaign on a list that was later assigned to a brand
  await seed();
  const legacy = await createCampaignRecord({ name: "L", subject: "s", preheader: null, fromEmail: "X <a@b.com>", body: "b", html: null, listId: "legacy", cohort: null, sendAt: TUE_10 }, "jason");
  t("legacy list keeps old behaviour (scheduled directly)", legacy.status === "scheduled" && !legacy.brandKey);
  db.list.find((l) => l.id === "legacy").brandKey = "scs";
  d = await dispatchCampaign(legacy.id, "system:cron");
  t("…but is blocked once its list is assigned to a brand", !d.ok && d.blocked && resendCalls.length === 0);

  // audit trail written
  t("audit trail has entries", db.auditLog.length > 0 && db.auditLog.some((a) => a.action === "send_blocked") && db.auditLog.some((a) => a.action === "campaign_created"));

  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
