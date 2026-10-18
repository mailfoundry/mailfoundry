#!/usr/bin/env node
/**
 * End-to-end test of the ChatGPT agent workflow against the LIVE MailFoundry API,
 * using ONLY the "Agent Test" list (your own addresses). Nothing is sent to customers.
 *
 *   node scripts/agent-e2e.mjs
 *
 * You'll be asked to paste an agent token (input hidden, never saved) and, at two points,
 * to approve the campaign in MailFoundry before pressing Enter. The test campaign is
 * planned 3 hours ahead and cancelled at the end, so nothing is sent except [TEST] copies.
 */
import readline from "node:readline";

const BASE = (process.env.MF_BASE ?? "https://ibsa.xylouk.co.uk").replace(/\/$/, "");
const API = `${BASE}/api/agent/v1`;
let pass = 0;
let fail = 0;

function ask(q, hidden = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    if (hidden) rl._writeToOutput = (s) => rl.output.write(s.includes(q) ? s : "");
    rl.question(q, (a) => { rl.close(); if (hidden) process.stdout.write("\n"); resolve(a.trim()); });
  });
}
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${extra ? ` — ${JSON.stringify(extra).slice(0, 400)}` : ""}`); }
};

const TOKEN = process.env.MF_TOKEN || (await ask("Paste agent token (hidden): ", true));
async function call(method, path, body, auth = true) {
  const res = await fetch(path.startsWith("http") ? path : `${API}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${TOKEN}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  let data = null;
  try { data = await res.json(); } catch { /* not JSON */ }
  return { status: res.status, data };
}

console.log(`\nMailFoundry agent E2E — ${BASE}\n`);

// 0. Auth
console.log("0. Authentication");
ok("no token → 401", (await call("GET", "/brands", null, false)).status === 401);
ok("bad token → 401", (await fetch(`${API}/brands`, { headers: { Authorization: "Bearer mfa_nope" } })).status === 401);
const brands = await call("GET", "/brands");
ok("valid token → brands", brands.status === 200 && brands.data?.brands?.length >= 1, brands);
if (brands.status !== 200) process.exit(1);

// 1. Find the test list
console.log("1. Lists");
const lists = await call("GET", "/lists?brand=scs");
const testList = lists.data?.lists?.find((l) => l.testList);
ok("an SCS test list exists (Settings → Brands → Lists)", !!testList, lists.data);
if (!testList) process.exit(1);
const swfList = (await call("GET", "/lists?brand=swf")).data?.lists?.[0];

// 2. Create a draft
console.log("2. Create draft via API");
const planned = new Date(Date.now() + 3 * 3600_000).toISOString().replace(/\.\d+Z$/, "Z");
const draft = {
  brand: "scs",
  name: `E2E test ${new Date().toISOString().slice(0, 16)}`,
  subject: "E2E test — please ignore",
  previewText: "Agent workflow test",
  html: "<p>Hi {{firstName|there}},</p><p>This is an <strong>end-to-end test</strong> of the agent workflow.</p>",
  text: "Hi {{firstName|there}},\n\nThis is an end-to-end test of the agent workflow.",
  listId: testList.id,
  plannedSendAt: planned,
  conceptNotes: "E2E test: checks drafts, approvals, scheduling and cancel.",
};
const created = await call("POST", "/campaigns", draft);
ok("201 created", created.status === 201, created.data);
const c = created.data?.campaign;
if (!c) process.exit(1);
console.log(`     campaign: ${BASE}/campaigns/${c.id}`);

// 3. Content preserved, brand + list correct
console.log("3. Content, brand and audience");
const got = (await call("GET", `/campaigns/${c.id}`)).data?.campaign;
ok("subject preserved", got?.subject === draft.subject);
ok("preview text preserved", got?.previewText === draft.previewText);
ok("HTML preserved", got?.html === draft.html);
ok("plain text preserved", got?.text === draft.text);
ok("From forced to SCS sender", /info@staffordshirecleaningsupplies\.co\.uk/.test(got?.from ?? ""), got?.from);
ok("status draft, stage draft", got?.status === "draft" && got?.stage === "draft", got);
ok("test list selected", got?.testList === true && got?.listId === testList.id);
if (swfList) {
  const wrong = await call("POST", "/campaigns", { ...draft, listId: swfList.id });
  ok("SCS campaign on an SWF list refused", wrong.status === 422, wrong.data);
}
const bare = await call("PATCH", `/campaigns/${c.id}`, { html: "<p>Hi {{firstName}},</p>" });
ok("bare {{firstName}} flagged as an issue", (bare.data?.campaign?.issues ?? []).some((i) => i.includes("firstName|there")), bare.data);
await call("PATCH", `/campaigns/${c.id}`, { html: draft.html });

// 4. Preview + test send
console.log("4. Preview and test send");
const prev = await call("GET", `/campaigns/${c.id}/preview`);
ok("preview renders with sample name", prev.status === 200 && prev.data?.html?.includes("Hi Jane"), prev.data?.subject);
ok("no-name contacts see 'Hi there'", prev.data?.firstLineForContactWithNoName === "Hi there,", prev.data?.firstLineForContactWithNoName);
const test = await call("POST", `/campaigns/${c.id}/test`, {});
ok("test send to test list only", test.status === 200 && test.data?.sentTo?.length >= 1, test.data);
const outsider = await call("POST", `/campaigns/${c.id}/test`, { email: "someone-else@example.com" });
ok("test send to an address not on the test list refused", outsider.status === 422, outsider.data);

// 5. Scheduling blocked without approvals
console.log("5. Scheduling blocked until approved");
let sch = await call("POST", `/campaigns/${c.id}/schedule`);
ok("refused: concept not approved", sch.status === 409 && sch.data?.error?.code === "concept_approval_required", sch.data);
await call("POST", `/campaigns/${c.id}/concept`, { conceptNotes: draft.conceptNotes });
await ask(`\n   → In MailFoundry open ${BASE}/campaigns/${c.id} and click "Approve concept". Then press Enter… `);
sch = await call("POST", `/campaigns/${c.id}/schedule`);
ok("refused: final approval missing", sch.status === 409 && sch.data?.error?.code === "final_approval_required", sch.data);

// 6. Final approval → schedule
await ask(`   → Now click "Approve final for … contacts" on the same page. Then press Enter… `);
const approved = (await call("GET", `/campaigns/${c.id}`)).data?.campaign;
ok("final approval recorded by you", approved?.approvals?.final?.valid === true, approved?.approvals);

// 7. Edit after approval invalidates it
console.log("6. Edit after approval");
await call("PATCH", `/campaigns/${c.id}`, { subject: "E2E test — edited after approval" });
const afterEdit = (await call("GET", `/campaigns/${c.id}`)).data?.campaign;
ok("approval no longer valid after edit", !afterEdit?.approvals?.final || afterEdit.approvals.final.valid === false, afterEdit?.approvals);
sch = await call("POST", `/campaigns/${c.id}/schedule`);
ok("schedule refused after edit", sch.status === 409, sch.data);
await ask(`   → Click "Approve final" once more (the edit needs re-approval). Then press Enter… `);

console.log("7. Schedule, view, cancel");
sch = await call("POST", `/campaigns/${c.id}/schedule`);
ok("scheduled after re-approval", sch.status === 200 && sch.data?.campaign?.status === "scheduled", sch.data);
const listed = await call("GET", `/campaigns?brand=scs&status=scheduled`);
ok("appears in scheduled list", listed.data?.campaigns?.some((x) => x.id === c.id));
const resch = await call("POST", `/campaigns/${c.id}/reschedule`, { plannedSendAt: new Date(Date.now() + 4 * 3600_000).toISOString() });
ok("reschedule unschedules and needs re-approval", resch.status === 200 && resch.data?.campaign?.status === "draft", resch.data);
const cancel = await call("POST", `/campaigns/${c.id}/cancel`);
ok("cancelled", cancel.status === 200 && cancel.data?.campaign?.status === "cancelled", cancel.data);
const again = await call("POST", `/campaigns/${c.id}/schedule`);
ok("cancelled campaign can't be scheduled", again.status === 409, again.data);

// 8. No way to send directly
console.log("8. No direct send / no bypass");
const direct = await call("POST", `${BASE}/api/campaigns/${c.id}/send`);
ok("agent token can't use the UI send endpoint", direct.status === 401 || direct.status === 307 || direct.status === 308, direct.status);
const noSend = await call("POST", `/campaigns/${c.id}/send`);
ok("no /send endpoint in the agent API", noSend.status === 404 || noSend.status === 405, noSend.status);

// 9. Reporting
console.log("9. Reporting");
const stats = await call("GET", `/campaigns/${c.id}/stats`);
ok("stats endpoint", stats.status === 200 && stats.data?.stats?.sent === 0, stats.data);
const summary = await call("GET", "/summary");
ok("weekly summary", summary.status === 200 && Array.isArray(summary.data?.brands), summary.data?.week);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
