import { NextResponse } from "next/server";
import { agentRoute, apiError, readJson } from "@/src/lib/agent-auth";
import { parseUkDateTime } from "@/src/lib/brand-rules";
import { parseCohort, updateCampaignRecord } from "@/src/lib/campaign-save";
import { campaignView, loadCampaign } from "@/src/lib/agent-views";

type P = { id: string };
const has = (b: Record<string, unknown>, k: string) => Object.prototype.hasOwnProperty.call(b, k);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export const GET = agentRoute<P>("campaigns.get", async ({ req, params }) => {
  const c = await loadCampaign(params.id);
  if (!c?.brandKey) return apiError("not_found", "Campaign not found", 404);
  const includeHtml = new URL(req.url).searchParams.get("includeHtml") === "true";
  return NextResponse.json({ campaign: await campaignView(c, { full: true, includeHtml }) });
});

// Partial update of an unsent campaign. Any change to approved content/audience/time revokes final approval.
export const PATCH = agentRoute<P>("campaigns.update", async ({ req, agent, params }) => {
  const c = await loadCampaign(params.id);
  if (!c?.brandKey) return apiError("not_found", "Campaign not found", 404);
  const b = await readJson(req);
  if (has(b, "brand") && str(b.brand).toLowerCase() !== c.brandKey) return apiError("invalid_input", "brand can't be changed", 422);
  let plannedSendAt: Date | null | undefined = undefined; // undefined = keep
  if (has(b, "plannedSendAt")) {
    plannedSendAt = b.plannedSendAt ? parseUkDateTime(b.plannedSendAt) : null;
    if (b.plannedSendAt && !plannedSendAt) return apiError("invalid_input", "plannedSendAt must be e.g. 2026-10-27T10:00 (UK time)", 422);
  }

  await updateCampaignRecord(
    c.id,
    {
      name: has(b, "name") ? str(b.name) : c.name,
      subject: has(b, "subject") ? str(b.subject) : c.subject,
      preheader: has(b, "previewText") ? str(b.previewText) || null : c.preheader,
      fromEmail: null,
      body: has(b, "text") ? str(b.text) : c.body,
      html: has(b, "html") ? str(b.html) || null : c.html,
      listId: has(b, "listId") ? str(b.listId) : c.listId,
      cohort: has(b, "group") ? parseCohort(b.group) : c.cohort,
      sendAt: plannedSendAt,
      conceptNotes: has(b, "conceptNotes") ? str(b.conceptNotes) || null : undefined,
    },
    agent.actor,
    { requireBrand: c.brandKey }
  );
  const fresh = await loadCampaign(c.id);
  return NextResponse.json({ campaign: await campaignView(fresh!, { full: true }) });
});
