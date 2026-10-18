import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { agentRoute, apiError, readJson } from "@/src/lib/agent-auth";
import { audit, invalidateIfChanged, parseUkDateTime } from "@/src/lib/brand-rules";
import { campaignView, loadCampaign } from "@/src/lib/agent-views";

// Change the planned time of an unsent campaign. The send time is part of the final approval,
// so this unschedules the campaign and it needs Jason's re-approval.
export const POST = agentRoute<{ id: string }>("campaigns.reschedule", async ({ req, agent, params }) => {
  const c = await loadCampaign(params.id);
  if (!c?.brandKey) return apiError("not_found", "Campaign not found", 404);
  if (["sending", "sent", "cancelled"].includes(c.status)) return apiError("invalid_state", `Campaign is ${c.status}`, 409);
  const b = await readJson(req);
  const at = parseUkDateTime(b.plannedSendAt);
  if (!at) return apiError("invalid_input", "plannedSendAt must be e.g. 2026-10-27T10:00 (UK time)", 422);

  await prisma.campaign.update({
    where: { id: c.id },
    data: { plannedSendAt: at, ...(c.status === "scheduled" ? { status: "draft", scheduledAt: null } : {}) },
  });
  await invalidateIfChanged(c.id, agent.actor);
  await audit(agent.actor, "rescheduled", { campaignId: c.id, brandKey: c.brandKey, detail: { from: c.plannedSendAt, to: at } });
  const fresh = await loadCampaign(c.id);
  return NextResponse.json({ campaign: await campaignView(fresh!), next: "Needs Jason's final re-approval before it can be scheduled." });
});
