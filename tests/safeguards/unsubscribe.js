// Branded {{unsubscribe_url}} handling: one visible unsubscribe section, secure per-recipient URL, no bypass.
process.env.APP_BASE_URL = "https://ibsa.xylouk.co.uk";
process.env.UNSUBSCRIBE_HMAC_SECRET = "test-secret";
process.env.RESEND_API_KEY = "test";
const F = require("./out/lib/emailFooter.js");
const { signEmail, listUnsubscribeHeaders } = require("./out/lib/unsubscribe.js");
const { prisma, __db: db, __reset } = require("./out/lib/prisma.js");
const R = require("./out/lib/brand-rules.js");
const { dispatchCampaign } = require("./out/lib/dispatch.js");

let pass = 0, fail = 0;
const t = (n, c, x) => { if (c) pass++; else { fail++; console.log("FAIL:", n, x ?? ""); } };
const count = (s, re) => (s.match(re) || []).length;
const VISIBLE_UNSUB = />\s*Unsubscribe\s*</gi; // visible "Unsubscribe" link text
const SWF = "Staffordshire Wood Fuels <info@staffordshirewoodfuels.co.uk>";
const SCS = "Staffordshire Cleaning Supplies <info@staffordshirecleaningsupplies.co.uk>";
const email = "Jane.Doe@Example.com";
const expected = `https://ibsa.xylouk.co.uk/unsubscribe?email=${encodeURIComponent("jane.doe@example.com")}&sig=${signEmail("jane.doe@example.com")}`;

// The SWF branded footer as ChatGPT builds it
const swfBranded = `<html><body><table><tr><td>Hi Jane, logs are in.</td></tr>
<tr><td style="background:#1f3d2b;color:#fff;padding:20px">Staffordshire Wood Fuels · Stoke-on-Trent<br>
<a href="{{unsubscribe_url}}" style="color:#cfe3d4">Unsubscribe</a></td></tr></table></body></html>`;
const scsBranded = swfBranded.replace("#1f3d2b", "#0b4f8a").replace("Staffordshire Wood Fuels", "Staffordshire Cleaning Supplies");

// 1. Branded footer → placeholder filled, no second footer
let out = F.addEmailFooter(swfBranded, email, SWF);
t("SWF branded: exactly one visible Unsubscribe", count(out, VISIBLE_UNSUB) === 1, out);
t("SWF branded: no MailFoundry footer", !out.includes("You are receiving this email because"));
t("SWF branded: placeholder replaced", !out.includes("{{unsubscribe_url}}"));
t("SWF branded: secure recipient URL", out.includes(expected.replace(/&/g, "&amp;")));
t("SWF branded: branding untouched", out.includes("#1f3d2b") && out.includes("Stoke-on-Trent"));
out = F.addEmailFooter(scsBranded, "b@x.com", SCS);
t("SCS branded: one Unsubscribe, own colours", count(out, VISIBLE_UNSUB) === 1 && out.includes("#0b4f8a"));
t("spaces inside braces accepted", F.checkUnsubscribe('<a href="{{ unsubscribe_url }}">Unsubscribe</a>').validLinks === 1);
t("single quotes accepted", F.checkUnsubscribe("<a href='{{unsubscribe_url}}'>Opt out</a>").validLinks === 1);

// 2. No link → standard footer
out = F.addEmailFooter("<p>Hi</p>", email, SWF);
t("no placeholder: standard footer added", count(out, VISIBLE_UNSUB) === 1 && out.includes("Staffordshire Wood Fuels mailing list"));

// 3. Bypass attempts all get the standard footer
const attempts = {
  "arbitrary link labelled Unsubscribe": '<a href="https://evil.example/unsub">Unsubscribe</a>',
  "placeholder as text only": "<p>Unsubscribe: {{unsubscribe_url}}</p>",
  "hidden link (display:none)": '<a href="{{unsubscribe_url}}" style="display:none">Unsubscribe</a>',
  "hidden link (font-size:0)": '<a href="{{unsubscribe_url}}" style="font-size:0">Unsubscribe</a>',
  "empty link text": '<a href="{{unsubscribe_url}}"><span></span>&nbsp;</a>',
  "malformed {{unsubscribeUrl}}": '<a href="{{unsubscribeUrl}}">Unsubscribe</a>',
  "malformed {unsubscribe_url}": '<a href="{unsubscribe_url}">Unsubscribe</a>',
  "placeholder with junk after": '<a href="{{unsubscribe_url}}x">Unsubscribe</a>',
  "hidden attribute": '<a hidden href="{{unsubscribe_url}}">Unsubscribe</a>',
};
for (const [name, html] of Object.entries(attempts)) {
  const o = F.addEmailFooter(html, email, SWF);
  t(`bypass blocked: ${name}`, o.includes("You are receiving this email because") && o.includes(expected.replace(/&/g, "&amp;")), o);
}
t("malformed tags detected", F.checkUnsubscribe('<a href="{{unsubscribeUrl}}">x</a> {unsubscribe_url} {{ opt-out }}').malformed.length === 3);
t("valid tag not reported as malformed", F.checkUnsubscribe('<a href="{{unsubscribe_url}}">Unsubscribe</a>').malformed.length === 0);
t("font-size:12px is not treated as hidden", F.checkUnsubscribe('<a href="{{unsubscribe_url}}" style="font-size:12px">Unsubscribe</a>').validLinks === 1);
t("font-size:0.8em is not treated as hidden", F.checkUnsubscribe('<a href="{{unsubscribe_url}}" style="font-size:0.8em">Unsubscribe</a>').validLinks === 1);

// 4. Plain text always has a working unsubscribe
let txt = F.addTextFooter("Hi Jane\nLogs are in.", email, SWF);
t("text without placeholder gets unsubscribe line", txt.includes(`Unsubscribe: ${expected}`));
txt = F.addTextFooter("Hi\nUnsubscribe here: {{unsubscribe_url}}", email, SWF);
t("text placeholder replaced, no duplicate line", txt.includes(`Unsubscribe here: ${expected}`) && count(txt, /Unsubscribe/g) === 1);
txt = F.addTextFooter("Hi {{unsubscribe_url}} and {{unsubscribe_url}}", email, SWF);
t("repeated text placeholders all replaced", !txt.includes("{{") && count(txt, /unsubscribe\?email/g) === 2);

// 5. One-click header unchanged
const h = listUnsubscribeHeaders(email);
t("List-Unsubscribe header present", h["List-Unsubscribe"].includes("/unsubscribe/one-click?email=") && h["List-Unsubscribe-Post"] === "List-Unsubscribe=One-Click");

(async () => {
  // 6. Live send path (fake Resend): branded footer → one section, URL not click-tracked, text has link, headers kept
  __reset();
  const sent = [];
  global.fetch = async (_u, o) => { sent.push(...JSON.parse(o.body)); return { ok: true, text: async () => "" }; };
  db.brand.push({ key: "swf", name: "Staffordshire Wood Fuels", fromName: "Staffordshire Wood Fuels", fromEmail: "info@staffordshirewoodfuels.co.uk", status: "go", weeklyCapPerContact: 1, maxAudiencePerSend: null, sendDays: "2,4", sendWindowStart: "10:00", sendWindowEnd: "11:00", agentSchedulingEnabled: false, postmasterSpamRate: null, postmasterUpdatedAt: null });
  db.list.push({ id: "eng", name: "SWF Engaged", brandKey: "swf", isTest: false });
  db.contact.push({ id: "k1", email: "k1@x.com", firstName: "Kim", lastName: null, subscribedAt: new Date(2025, 0, 1), unsubscribedAt: null, archivedAt: null, bouncedAt: null, complainedAt: null });
  db.contactList.push({ id: "l1", contactId: "k1", listId: "eng" });
  const planned = R.parseUkDateTime("2026-10-20T10:00");
  const html = swfBranded.replace("Hi Jane, logs are in.", 'Hi {{firstName|there}}, <a href="https://www.staffordshirewoodfuels.co.uk/products">Shop logs</a>');
  db.campaign.push({ id: "camp", name: "c", subject: "Ready for the colder evenings?", preheader: "p", fromEmail: SWF, body: "Hi {{firstName|there}}", html, listId: "eng", brandKey: "swf", cohort: null, plannedSendAt: planned, status: "scheduled", conceptNotes: "x", createdBy: "agent:t", blockedReason: null, cancelledAt: null, scheduledAt: planned, createdAt: new Date(), updatedAt: new Date() });

  let pf = await R.preflight("camp", "approve", new Date("2026-10-18T12:00:00Z"));
  t("branded campaign passes preflight, no footer warning", pf.ok && !pf.warnings.some((w) => w.includes("standard MailFoundry footer")), pf);
  const c = db.campaign[0];
  db.campaignApproval.push({ id: "a", campaignId: "camp", kind: "final", fingerprint: R.finalFingerprint(c), audienceSize: 1, sendAt: planned, approvedBy: "jason", approvedAt: new Date(), revokedAt: null });
  const fpBefore = R.finalFingerprint(c);
  const d = await dispatchCampaign("camp", "system:cron");
  t("dispatch sent", d.ok && d.sent === 1, d);
  const msg = sent[0];
  t("live: one visible Unsubscribe", msg && count(msg.html, VISIBLE_UNSUB) === 1, msg?.html);
  const kUrl = `https://ibsa.xylouk.co.uk/unsubscribe?email=k1%40x.com&amp;sig=${signEmail("k1@x.com")}`;
  t("live: unsubscribe link is direct (not click-tracked)", msg.html.includes(`href="${kUrl}"`));
  t("live: product link IS click-tracked", msg.html.includes("/api/track/click?") && msg.html.includes(encodeURIComponent("https://www.staffordshirewoodfuels.co.uk/products")));
  t("live: plain text has unsubscribe", msg.text.includes("Unsubscribe: https://ibsa.xylouk.co.uk/unsubscribe?email=k1%40x.com"));
  t("live: List-Unsubscribe headers kept", msg.headers["List-Unsubscribe-Post"] === "List-Unsubscribe=One-Click");
  t("approval fingerprint unchanged by rendering", R.finalFingerprint(db.campaign[0]) === fpBefore);

  // malformed tag blocks approval
  db.campaign[0].html = '<p>Hi</p><a href="{{unsubscribeUrl}}">Unsubscribe</a>';
  db.campaign[0].status = "draft";
  pf = await R.preflight("camp", "approve", new Date("2026-10-18T12:00:00Z"));
  t("malformed tag blocks approval", !pf.ok && pf.errors.some((e) => e.includes("Malformed unsubscribe tag")), pf.errors);
  db.campaign[0].html = "<p>Hi, no footer</p>";
  pf = await R.preflight("camp", "approve", new Date("2026-10-18T12:00:00Z"));
  t("no branded link → allowed, with footer warning", pf.ok && pf.warnings.some((w) => w.includes("standard MailFoundry footer")), pf);

  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
