// Six-day calendar: SCS Mon/Wed/Fri 09:00–11:00 (pref 09:30), SWF Tue/Thu/Sat 08:00–10:00 (pref 08:15),
// one-off exception, SWF 1/week + engaged list only, test-before-approval, DST.
process.env.RESEND_API_KEY = "test";
const { __db: db, __reset } = require("./out/lib/prisma.js");
const R = require("./out/lib/brand-rules.js");
const { dispatchCampaign } = require("./out/lib/dispatch.js");
const { createCampaignRecord, updateCampaignRecord } = require("./out/lib/campaign-save.js");

let pass = 0, fail = 0;
const t = (n, c, x) => { if (c) pass++; else { fail++; console.log("FAIL:", n, x ?? ""); } };
const has = (pf, s) => pf.errors.some((e) => e.includes(s));
const NOW = new Date("2026-10-19T10:42:00Z"); // Mon 19 Oct 11:42 BST
const at = (s) => R.parseUkDateTime(s);
let sent = [];
global.fetch = async (_u, o) => { sent.push(...JSON.parse(o.body).map((p) => p.to)); return { ok: true, text: async () => "" }; };

function seed() {
  __reset(); sent = [];
  db.brand.push(
    { key: "scs", name: "Staffordshire Cleaning Supplies", fromName: "Staffordshire Cleaning Supplies", fromEmail: "info@staffordshirecleaningsupplies.co.uk", status: "go", weeklyCapPerContact: 1, maxAudiencePerSend: 1000, sendDays: "1,3,5", sendWindowStart: "09:00", sendWindowEnd: "11:00", preferredTimes: "1=09:30,3=09:30,5=09:30", maxCampaignsPerWeek: null, requiredListId: null, agentSchedulingEnabled: false, postmasterSpamRate: null, postmasterUpdatedAt: null },
    { key: "swf", name: "Staffordshire Wood Fuels", fromName: "Staffordshire Wood Fuels", fromEmail: "info@staffordshirewoodfuels.co.uk", status: "go", statusReason: "Recovery", weeklyCapPerContact: 1, maxAudiencePerSend: null, sendDays: "2,4,6", sendWindowStart: "08:00", sendWindowEnd: "10:00", preferredTimes: "2=08:15,4=08:15,6=08:15", maxCampaignsPerWeek: 1, requiredListId: "eng", agentSchedulingEnabled: false, postmasterSpamRate: null, postmasterUpdatedAt: null },
  );
  db.list.push({ id: "warm", name: "SCS Warm-up", brandKey: "scs", isTest: false }, { id: "eng", name: "SWF Engaged", brandKey: "swf", isTest: false }, { id: "swfall", name: "SWF Customers", brandKey: "swf", isTest: false });
  const ok = { subscribedAt: new Date(2025, 0, 1), unsubscribedAt: null, archivedAt: null, bouncedAt: null, complainedAt: null, firstName: null, lastName: null };
  for (let i = 0; i < 30; i++) { db.contact.push({ id: "c" + i, email: `c${i}@x.com`, ...ok }); db.contactList.push({ id: "w" + i, contactId: "c" + i, listId: "warm" }, { id: "e" + i, contactId: "c" + i, listId: "eng" }, { id: "s" + i, contactId: "c" + i, listId: "swfall" }); }
}
async function make(listId, sendAt, cohort = null, name = "Camp") {
  const c = await createCampaignRecord({ name, subject: "Subject", preheader: "P", fromEmail: null, body: "Hi {{firstName|there}}", html: '<p>Hi {{firstName|there}}</p><a href="{{unsubscribe_url}}">Unsubscribe</a>', listId, cohort, sendAt }, "agent:test");
  await R.recordTestSend(c.id);
  return db.campaign.find((x) => x.id === c.id);
}
async function approveFinal(c) {
  const pf = await R.preflight(c.id, "approve", NOW);
  db.campaignApproval.push({ id: "ap" + Math.random(), campaignId: c.id, kind: "final", fingerprint: R.finalFingerprint(c), audienceSize: pf.audienceSize, sendAt: c.plannedSendAt, approvedBy: "jason", approvedAt: new Date(), revokedAt: null });
}

(async () => {
  // 1. SCS Mon/Wed/Fri inside window
  seed();
  for (const s of ["2026-10-21T09:30", "2026-10-23T09:00", "2026-10-26T11:00"]) {
    const pf = await R.preflight((await make("warm", at(s), "B")).id, "approve", NOW);
    t(`1. SCS ${s} permitted`, pf.ok, pf.errors);
  }
  const pfNonPref = await R.preflight((await make("warm", at("2026-10-21T10:15"), "B")).id, "approve", NOW);
  t("1b. non-preferred time inside window permitted, with a warning", pfNonPref.ok && pfNonPref.warnings.some((w) => w.includes("Preferred SCS time on Wed is 09:30")), pfNonPref);

  // 2. SWF Tue/Thu/Sat inside window (one per week each, so use different weeks)
  for (const s of ["2026-10-20T08:15", "2026-10-29T08:00", "2026-11-07T10:00"]) {
    seed();
    const pf = await R.preflight((await make("eng", at(s))).id, "approve", NOW);
    t(`2. SWF ${s} permitted`, pf.ok, pf.errors);
  }

  // 3. Other days / outside window rejected
  seed();
  for (const [list, s, msg] of [["warm", "2026-10-20T09:30", "sends only on Mon/Wed/Fri"], ["warm", "2026-10-21T11:30", "between 09:00 and 11:00"], ["warm", "2026-10-24T09:30", "sends only on Mon/Wed/Fri"], ["eng", "2026-10-21T08:15", "sends only on Tue/Thu/Sat"], ["eng", "2026-10-20T10:30", "between 08:00 and 10:00"], ["eng", "2026-10-25T08:15", "sends only on Tue/Thu/Sat"]]) {
    const pf = await R.preflight((await make(list, at(s), list === "warm" ? "A" : null)).id, "approve", NOW);
    t(`3. ${list === "warm" ? "SCS" : "SWF"} ${s} rejected`, has(pf, msg), pf.errors);
    db.campaign.forEach((c) => (c.status = "cancelled")); // keep SWF weekly cap out of the way
  }

  // 4. 19 Oct 14:00 exception applies only to that campaign, date and time
  seed();
  const ubik = await make("warm", at("2026-10-19T14:00"), "A", "Ubik 2000");
  const other = await make("warm", at("2026-10-19T14:00"), "B", "Other");
  db.scheduleException.push({ id: "x1", brandKey: "scs", campaignId: ubik.id, date: "2026-10-19", startTime: "14:00", endTime: "14:00", reason: "one-off", createdBy: "jason" });
  let pf = await R.preflight(ubik.id, "approve", NOW);
  t("4. Ubik 14:00 Mon 19 Oct allowed by exception", pf.ok && pf.warnings.some((w) => w.includes("One-off exception")), pf);
  t("4b. another campaign same slot still rejected", !(await R.preflight(other.id, "approve", NOW)).ok);
  ubik.plannedSendAt = at("2026-10-19T14:30");
  t("4c. Ubik at 14:30 rejected (exception is 14:00 only)", has(await R.preflight(ubik.id, "approve", NOW), "between 09:00 and 11:00"));
  ubik.plannedSendAt = at("2026-10-26T14:00");
  t("4d. Ubik on another date rejected", has(await R.preflight(ubik.id, "approve", NOW), "between 09:00 and 11:00"));
  ubik.plannedSendAt = at("2026-10-19T14:00");
  t("4e. after 14:00 has passed, no backdating (5-minute rule)", has(await R.preflight(ubik.id, "approve", new Date("2026-10-19T13:00:00Z")), "at least 5 minutes in the future"));
  t("4f. exception doesn't change status or schedule", ubik.status === "draft" && ubik.scheduledAt === null);

  // 5. SWF recovery: 1 campaign/week, engaged list only
  seed();
  const swf1 = await make("eng", at("2026-10-20T08:15"));
  await approveFinal(swf1);
  const swf2 = await make("eng", at("2026-10-22T08:15"));
  pf = await R.preflight(swf2.id, "approve", NOW);
  t("5. second SWF campaign same week blocked", has(pf, "limited to 1 campaign per week"), pf.errors);
  const swf3 = await make("eng", at("2026-10-27T08:15"));
  t("5b. SWF next week allowed", (await R.preflight(swf3.id, "approve", NOW)).ok);
  const swfAll = await make("swfall", at("2026-11-03T08:15"));
  t("5c. SWF on non-engaged list blocked", has(await R.preflight(swfAll.id, "approve", NOW), "engaged list only"));
  swf1.status = "cancelled";
  t("5d. cancelling frees the week", (await R.preflight(swf2.id, "approve", NOW)).ok);

  // 6. Contact 7-day cap still enforced at send
  seed();
  const prev = await make("warm", at("2026-10-19T09:30"), null, "prev");
  db.campaignSend.push({ id: "p1", campaignId: prev.id, contactId: "c3", email: "c3@x.com", status: "sent", sentAt: new Date("2026-10-15T10:40:00Z") });
  const capped = await R.cappedContacts("scs", 1, ["c3", "c4"], new Date("2026-10-21T08:30:00Z"));
  t("6. contact emailed 15 Oct capped on 21 Oct", capped.has("c3") && !capped.has("c4"));
  const capped2 = await R.cappedContacts("scs", 1, ["c3"], new Date("2026-10-23T08:30:00Z"));
  t("6b. same contact allowed again on 23 Oct", !capped2.has("c3"));

  // 7. Approvals invalidated by time change; test-before-approval enforced
  seed();
  const v = await make("warm", at("2026-10-21T09:30"), "B", "Vanquish");
  await approveFinal(v);
  t("7. approved campaign schedulable", (await R.preflight(v.id, "schedule", NOW)).ok);
  await updateCampaignRecord(v.id, { name: v.name, subject: v.subject, preheader: v.preheader, fromEmail: null, body: v.body, html: v.html, listId: v.listId, cohort: v.cohort, sendAt: at("2026-10-23T09:30") }, "agent:test");
  t("7b. moving the time revokes final approval", db.campaignApproval.every((a) => a.revokedAt) && has(await R.preflight(v.id, "schedule", NOW), "final_approval_required"));
  const untested = await createCampaignRecord({ name: "u", subject: "s", preheader: "p", fromEmail: null, body: "b", html: null, listId: "warm", cohort: "C", sendAt: at("2026-10-23T09:30") }, "agent:test");
  t("7c. final approval needs a test first", has(await R.preflight(untested.id, "approve", NOW), "test_required: send a test"));
  await R.recordTestSend(untested.id);
  db.campaign.find((c) => c.id === untested.id).subject = "changed after test";
  t("7d. content changed after test needs a new test", has(await R.preflight(untested.id, "approve", NOW), "content changed since the last test"));
  await R.recordTestSend(untested.id);
  db.campaign.find((c) => c.id === untested.id).plannedSendAt = at("2026-10-21T09:30");
  t("7e. changing only the time doesn't need a new test", !has(await R.preflight(untested.id, "approve", NOW), "test_required"));

  // 8. Config changes never send or schedule
  seed();
  const d = await make("warm", at("2026-10-21T09:30"), "B");
  db.brand[0].sendDays = "1,2,3,4,5"; db.brand[0].sendWindowStart = "07:00";
  await R.refreshBrandStatus("scs");
  t("8. config change leaves draft unscheduled", d.status === "draft" && d.scheduledAt === null && sent.length === 0);
  const r = await dispatchCampaign(d.id, "system:cron");
  t("8b. dispatch refuses unapproved draft", !r.ok && sent.length === 0);

  // 9. DST: 25 Oct 2026 clocks go back
  t("9. Fri 23 Oct 09:30 BST = 08:30Z", at("2026-10-23T09:30").toISOString() === "2026-10-23T08:30:00.000Z");
  t("9b. Mon 26 Oct 09:30 GMT = 09:30Z", at("2026-10-26T09:30").toISOString() === "2026-10-26T09:30:00.000Z");
  t("9c. SWF Sat 24 Oct 08:15 BST = 07:15Z", at("2026-10-24T08:15").toISOString() === "2026-10-24T07:15:00.000Z");
  t("9d. UK week of Sun 25 Oct starts Mon 19 Oct 00:00 BST", R.ukWeekStart(at("2026-10-25T20:00")).toISOString() === "2026-10-18T23:00:00.000Z");
  t("9e. UK week of Mon 26 Oct starts 00:00 GMT", R.ukWeekStart(at("2026-10-26T08:00")).toISOString() === "2026-10-26T00:00:00.000Z");
  seed();
  const sat = await make("eng", at("2026-10-24T08:15"));
  await approveFinal(sat);
  const sunAfterChange = await make("eng", at("2026-10-27T08:15"));
  t("9f. SWF weekly cap resets across the DST weekend", (await R.preflight(sunAfterChange.id, "approve", NOW)).ok);

  // 10. Existing drafts: moving time keeps content, no duplicates
  seed();
  const orig = await make("warm", at("2026-10-22T10:00"), "C", "Fresh Quarters");
  const before = { html: orig.html, subject: orig.subject, body: orig.body, cohort: orig.cohort, listId: orig.listId };
  const count = db.campaign.length;
  await updateCampaignRecord(orig.id, { ...before, name: orig.name, preheader: orig.preheader, fromEmail: null, sendAt: at("2026-10-23T09:30") }, "agent:test");
  const after = db.campaign.find((c) => c.id === orig.id);
  t("10. time moved, content/audience intact, no duplicate", db.campaign.length === count && after.html === before.html && after.subject === before.subject && after.cohort === "C" && after.plannedSendAt.toISOString() === "2026-10-23T08:30:00.000Z");

  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
