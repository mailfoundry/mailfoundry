process.env.DATABASE_URL = "postgresql://x:y@localhost/z";
const r = require("./out/lib/brand-rules.js");
const v = require("./out/lib/agent-views.js");
let pass = 0, fail = 0;
const t = (name, cond) => { if (cond) pass++; else { fail++; console.log("FAIL", name); } };

// cohorts: stable + roughly equal thirds
const ids = Array.from({ length: 30000 }, (_, i) => "c" + Math.random().toString(36).slice(2) + i);
const counts = { A: 0, B: 0, C: 0 }; ids.forEach((i) => counts[r.cohortOf(i)]++);
t("cohort stable", r.cohortOf("abc") === r.cohortOf("abc"));
t("cohort balance " + JSON.stringify(counts), Object.values(counts).every((n) => Math.abs(n - 10000) < 400));

// UK time parsing across BST/GMT
const bst = r.parseUkDateTime("2026-10-20T10:00"); // BST (+1)
const gmt = r.parseUkDateTime("2026-10-27T10:00"); // after 25 Oct clocks change → GMT
t("BST parse " + bst?.toISOString(), bst?.toISOString() === "2026-10-20T09:00:00.000Z");
t("GMT parse " + gmt?.toISOString(), gmt?.toISOString() === "2026-10-27T10:00:00.000Z");
t("ISO with Z", r.parseUkDateTime("2026-10-27T10:00:00Z")?.toISOString() === "2026-10-27T10:00:00.000Z");
t("invalid", r.parseUkDateTime("next tuesday") === null);
t("ukParts weekday Tue", r.ukParts(gmt).weekday === 2 && r.ukParts(gmt).hhmm === "10:00");
t("ukIso", r.ukIso(bst) === "2026-10-20T10:00 Europe/London");
t("ukMidnight BST", r.ukMidnight(new Date("2026-10-20T15:00:00Z")).toISOString() === "2026-10-19T23:00:00.000Z");
t("ukMidnight GMT", r.ukMidnight(new Date("2026-10-27T15:00:00Z")).toISOString() === "2026-10-27T00:00:00.000Z");

// address parsing
t("addressOf", r.addressOf("Staffordshire Cleaning Supplies <INFO@staffordshirecleaningsupplies.co.uk>") === "info@staffordshirecleaningsupplies.co.uk");
t("brandFrom", r.brandFrom({ fromName: "SCS", fromEmail: "a@b.c" }) === "SCS <a@b.c>");

// fingerprint changes on any approved field
const base = { brandKey: "scs", listId: "L1", cohort: "A", fromEmail: "x", subject: "S", preheader: "P", html: "<p>h</p>", body: "b", plannedSendAt: gmt };
const fp = r.finalFingerprint(base);
t("fp stable", fp === r.finalFingerprint({ ...base }));
for (const [k, val] of [["subject", "S2"], ["html", "<p>x</p>"], ["body", "b2"], ["listId", "L2"], ["cohort", "B"], ["plannedSendAt", bst], ["preheader", "P2"], ["fromEmail", "y"]]) {
  t("fp changes on " + k, fp !== r.finalFingerprint({ ...base, [k]: val }));
}

// week range
const w = v.weekRange("2026-W43");
t("W43 start " + w.start.toISOString(), w.start.toISOString() === "2026-10-18T23:00:00.000Z"); // Mon 19 Oct 00:00 BST
t("W43 end " + w.end.toISOString(), w.end.toISOString() === "2026-10-26T00:00:00.000Z");   // Mon 26 Oct 00:00 GMT
t("W43 label " + w.label, w.label === "2026-W43");
const def = v.weekRange();
t("default label is last full week " + def.label, /^2026-W4[12]$/.test(def.label));

// describeDays
t("describeDays", r.describeDays("2,3,4") === "Tue/Wed/Thu");
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
