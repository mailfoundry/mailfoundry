// HTML size / embedded-image limits on campaign save
const { __db: db, __reset } = require("./out/lib/prisma.js");
const { createCampaignRecord } = require("./out/lib/campaign-save.js");
let pass = 0, fail = 0;
const t = (n, c) => { if (c) pass++; else { fail++; console.log("FAIL:", n); } };
(async () => {
  __reset();
  db.brand.push({ key: "scs", name: "SCS", fromName: "SCS", fromEmail: "info@staffordshirecleaningsupplies.co.uk" });
  db.list.push({ id: "w", name: "SCS Warm-up", brandKey: "scs", isTest: false });
  const base = { name: "n", subject: "s", preheader: null, fromEmail: null, body: "b", listId: "w", cohort: "A", sendAt: null };
  const tryCreate = async (html) => { try { await createCampaignRecord({ ...base, html }, "agent:t", { requireBrand: "scs" }); return null; } catch (e) { return e.message; } };
  const big = "<p>" + "x".repeat(60 * 1024) + "</p>";
  t("60 KB branded HTML accepted", (await tryCreate(big)) === null);
  t("over 90 KB rejected with clear message", /KB/.test((await tryCreate("<p>" + "x".repeat(95 * 1024) + "</p>")) ?? ""));
  t("data: image rejected", /Embedded/.test((await tryCreate('<img src="data:image/png;base64,AAAA">')) ?? ""));
  t("hosted image accepted", (await tryCreate('<img src="https://www.staffordshirecleaningsupplies.co.uk/img/ubik.jpg">')) === null);
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
