import { NextResponse } from "next/server";
import { agentRoute, apiError } from "@/src/lib/agent-auth";
import { addEmailFooter, addPreheader, addTextFooter, checkUnsubscribe } from "@/src/lib/emailFooter";
import { applyMergeTags } from "@/src/lib/merge";
import { loadCampaign } from "@/src/lib/agent-views";

const SAMPLE = { firstName: "Jane", lastName: "Smith", email: "jane@example.com" };

// Rendered as a contact would see it (sample merge data, footer, preview text). ?format=html returns raw HTML.
export const GET = agentRoute<{ id: string }>("campaigns.preview", async ({ req, params }) => {
  const c = await loadCampaign(params.id);
  if (!c?.brandKey) return apiError("not_found", "Campaign not found", 404);
  const base = c.html?.trim() ? c.html : `<div style="font-family:Arial,sans-serif;line-height:1.6">${c.body.replace(/\n/g, "<br/>")}</div>`;
  const html = addPreheader(
    addEmailFooter(applyMergeTags(base, SAMPLE, { html: true }), SAMPLE.email, c.fromEmail),
    c.preheader ? applyMergeTags(c.preheader, SAMPLE, { html: true }) : c.preheader
  );
  const noName = applyMergeTags(c.body, { firstName: null, lastName: null, email: SAMPLE.email }).split("\n")[0];
  if (new URL(req.url).searchParams.get("format") === "html") {
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  return NextResponse.json({
    from: c.fromEmail,
    subject: applyMergeTags(c.subject, SAMPLE),
    previewText: c.preheader,
    text: addTextFooter(applyMergeTags(c.body, SAMPLE), SAMPLE.email, c.fromEmail),
    unsubscribe: (() => {
      const u = checkUnsubscribe(c.html);
      return {
        brandedLinkUsed: u.validLinks > 0,
        standardFooterAdded: u.validLinks === 0,
        malformedTags: u.malformed,
        hiddenOrEmptyLinks: u.hiddenLinks,
      };
    })(),
    firstLineForContactWithNoName: noName,
    html,
  });
});
