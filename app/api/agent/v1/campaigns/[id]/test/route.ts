import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { agentRoute, apiError, readJson } from "@/src/lib/agent-auth";
import { addEmailFooter, addPreheader } from "@/src/lib/emailFooter";
import { applyMergeTags } from "@/src/lib/merge";
import { listUnsubscribeHeaders } from "@/src/lib/unsubscribe";
import { sendEmail } from "@/src/lib/sendEmail";
import { audit, ELIGIBLE_CONTACT } from "@/src/lib/brand-rules";
import { loadCampaign } from "@/src/lib/agent-views";

const MAX_RECIPIENTS = 5;
const MAX_TESTS_PER_HOUR = 10;

// Test send — ONLY to contacts on a list marked "test list" (e.g. Agent Test). Subject is prefixed [TEST].
export const POST = agentRoute<{ id: string }>("campaigns.test", async ({ req, agent, params }) => {
  const c = await loadCampaign(params.id);
  if (!c?.brandKey) return apiError("not_found", "Campaign not found", 404);

  const recent = await prisma.auditLog.count({
    where: { campaignId: c.id, action: "test_sent", at: { gte: new Date(Date.now() - 3600_000) } },
  });
  if (recent >= MAX_TESTS_PER_HOUR) return apiError("rate_limited", `Max ${MAX_TESTS_PER_HOUR} test sends per campaign per hour`, 429);

  const b = await readJson(req);
  const wanted = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  const testContacts = await prisma.contact.findMany({
    where: { ...ELIGIBLE_CONTACT, lists: { some: { list: { isTest: true } } }, ...(wanted ? { email: wanted } : {}) },
    take: MAX_RECIPIENTS,
  });
  if (testContacts.length === 0) {
    return apiError("no_test_recipients", wanted ? `${wanted} is not on a test list` : "No contacts on a test list — Jason must create one (Settings → Brands → Lists)", 422);
  }

  const base = c.html?.trim() ? c.html : `<div style="font-family:Arial,sans-serif;line-height:1.6">${c.body.replace(/\n/g, "<br/>")}</div>`;
  const sentTo: string[] = [];
  for (const ct of testContacts) {
    await sendEmail({
      from: c.fromEmail ?? undefined,
      to: ct.email,
      subject: `[TEST] ${applyMergeTags(c.subject, ct)}`,
      text: applyMergeTags(c.body, ct),
      html: addPreheader(addEmailFooter(applyMergeTags(base, ct, { html: true }), ct.email, c.fromEmail), c.preheader ? applyMergeTags(c.preheader, ct, { html: true }) : c.preheader),
      headers: listUnsubscribeHeaders(ct.email),
    });
    sentTo.push(ct.email);
  }
  await audit(agent.actor, "test_sent", { campaignId: c.id, brandKey: c.brandKey, detail: { to: sentTo } });
  return NextResponse.json({ ok: true, sentTo });
});
