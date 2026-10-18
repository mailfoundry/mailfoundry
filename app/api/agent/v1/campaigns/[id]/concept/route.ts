import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { agentRoute, apiError, readJson } from "@/src/lib/agent-auth";
import { audit, parseUkDateTime } from "@/src/lib/brand-rules";
import { campaignView, loadCampaign } from "@/src/lib/agent-views";

// Submit (or resubmit) the concept for Jason's approval. Does NOT approve it — that happens in MailFoundry.
export const POST = agentRoute<{ id: string }>("campaigns.concept", async ({ req, agent, params }) => {
  const c = await loadCampaign(params.id);
  if (!c?.brandKey) return apiError("not_found", "Campaign not found", 404);
  if (["sending", "sent", "cancelled"].includes(c.status)) return apiError("invalid_state", `Campaign is ${c.status}`, 409);
  const b = await readJson(req);
  const notes = typeof b.conceptNotes === "string" ? b.conceptNotes.trim() : c.conceptNotes;
  if (!notes) return apiError("invalid_input", "conceptNotes required (angle, product, why, date)", 422);
  const planned = b.plannedSendAt ? parseUkDateTime(b.plannedSendAt) : c.plannedSendAt;
  if (b.plannedSendAt && !planned) return apiError("invalid_input", "plannedSendAt must be e.g. 2026-10-27T10:00 (UK time)", 422);

  await prisma.campaign.update({ where: { id: c.id }, data: { conceptNotes: notes, plannedSendAt: planned } });
  await audit(agent.actor, "concept_submitted", { campaignId: c.id, brandKey: c.brandKey, detail: { plannedSendAt: planned } });
  const fresh = await loadCampaign(c.id);
  return NextResponse.json({
    campaign: await campaignView(fresh!, { full: true }),
    next: "Ask Jason to approve the concept in MailFoundry (Campaigns → this campaign → Approve concept).",
  });
});
