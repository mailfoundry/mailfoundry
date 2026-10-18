#!/usr/bin/env node
/**
 * Live check of branded-footer unsubscribe handling, using ONLY the test list.
 *   node scripts/unsub-live-check.mjs
 * Creates an SCS test-list draft with a branded footer, checks the rendered preview has exactly one
 * unsubscribe section with a real signed URL, sends ONE [TEST] email to your test list, then cancels the draft.
 */
import readline from "node:readline";
const BASE = (process.env.MF_BASE ?? "https://ibsa.xylouk.co.uk").replace(/\/$/, "");
const API = `${BASE}/api/agent/v1`;
const ask = (q) => new Promise((r) => { const rl = readline.createInterface({ input: process.stdin, output: process.stdout }); rl._writeToOutput = (s) => rl.output.write(s.includes(q) ? s : ""); rl.question(q, (a) => { rl.close(); process.stdout.write("\n"); r(a.trim()); }); });
const TOKEN = process.env.MF_TOKEN || (await ask("Paste agent token (hidden): "));
const call = async (m, p, b) => { const r = await fetch(`${API}${p}`, { method: m, headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` }, body: b ? JSON.stringify(b) : undefined }); let d = null; try { d = await r.json(); } catch {} return { status: r.status, data: d }; };
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}${x ? " — " + JSON.stringify(x).slice(0, 300) : ""}`); } };

const testList = (await call("GET", "/lists?brand=scs")).data?.lists?.find((l) => l.testList);
if (!testList) { console.log("No SCS test list"); process.exit(1); }
const html = `<html><body><table width="100%"><tr><td style="padding:24px">Hi {{firstName|there}},<br>Branded footer check.</td></tr>
<tr><td style="background:#0b4f8a;color:#ffffff;padding:20px;font-family:Arial">Staffordshire Cleaning Supplies<br>
<a href="{{unsubscribe_url}}" style="color:#cfe0f2">Unsubscribe</a></td></tr></table></body></html>`;
const created = await call("POST", "/campaigns", {
  brand: "scs", name: `Unsub footer check ${new Date().toISOString().slice(0, 16)}`, subject: "Footer check — please ignore",
  previewText: "Branded unsubscribe test", html, text: "Hi {{firstName|there}},\nBranded footer check.", listId: testList.id,
  plannedSendAt: new Date(Date.now() + 3 * 3600_000).toISOString(),
});
const id = created.data?.campaign?.id;
ok("draft created on test list", created.status === 201 && id, created.data);

const prev = await call("GET", `/campaigns/${id}/preview`);
const out = prev.data?.html ?? "";
ok("preview: exactly one visible Unsubscribe", (out.match(/>\s*Unsubscribe\s*</gi) || []).length === 1, out.slice(-600));
ok("preview: no MailFoundry footer", !out.includes("You are receiving this email because"));
ok("preview: placeholder replaced with signed URL", !out.includes("{{unsubscribe_url}}") && /unsubscribe\?email=[^"]+&amp;sig=[0-9a-f]{64}/.test(out));
ok("preview: branded colours kept", out.includes("#0b4f8a"));
ok("preview: reports branded link used", prev.data?.unsubscribe?.brandedLinkUsed === true, prev.data?.unsubscribe);
ok("preview: plain text has unsubscribe", /Unsubscribe: https:\/\/\S+\/unsubscribe\?email=/.test(prev.data?.text ?? ""));

const bad = await call("PATCH", `/campaigns/${id}`, { html: html.replace("{{unsubscribe_url}}", "{{unsubscribeUrl}}") });
ok("malformed tag flagged as an issue", (bad.data?.campaign?.issues ?? []).some((i) => i.includes("Malformed unsubscribe tag")), bad.data?.campaign?.issues);
await call("PATCH", `/campaigns/${id}`, { html });

const test = await call("POST", `/campaigns/${id}/test`, {});
ok("[TEST] email sent to test list only", test.status === 200 && test.data?.sentTo?.length >= 1, test.data);
const cancel = await call("POST", `/campaigns/${id}/cancel`);
ok("draft cancelled (never scheduled)", cancel.data?.campaign?.status === "cancelled", cancel.data);

console.log(`\n${pass} passed, ${fail} failed\nCheck your inbox: the [TEST] "Footer check" email should show ONE blue footer with a working Unsubscribe link.\n`);
process.exit(fail ? 1 : 0);
