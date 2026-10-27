import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { agentRoute, apiError } from "@/src/lib/agent-auth";
import { activeApproval, audit, preflight, refreshBrandStatus } from "@/src/lib/brand-rules";
import { campaignView, loadCampaign } from "@/src/lib/agent-views";

// Schedule at the approved plannedSendAt. Refused unless Jason's final approval matches the current campaign
// and every brand rule passes. Rules are checked again at the moment of sending.
export const POST = agentRoute<{ id: string }>("campaigns.schedule", async ({ agent, params }) => {
  const c = await loadCampaign(params.id);
  if (!c?.brandKey || !c.brand) return apiError("not_found", "Campaign not found", 404);
  // Test-list campaigns (Jason's own addresses only) can be scheduled for end-to-end testing
  if (!c.brand.agentSchedulingEnabled && !c.list.isTest) {
    return apiError("agent_scheduling_disabled", `Agent scheduling is off for ${c.brand.name}. Ask Jason to schedule it in MailFoundry.`, 403);
  }
  if (!["draft", "blocked", "failed"].includes(c.status)) return apiError("invalid_state", `Campaign is ${c.status}`, 409);
  if (!(await activeApproval(c.id, "concept"))) return apiError("concept_approval_required", "Jason has not approved the concept", 409);

  await refreshBrandStatus(c.brandKey);
  const pf = await preflight(c.id, "schedule");
  if (!pf.ok) {
    const code = pf.errors.find((e) => e.startsWith("final_approval_"))?.split(":")[0] ?? "rules_failed";
    return apiError(code, "Scheduling refused", 409, { issues: pf.errors });
  }
  await prisma.campaign.update({ where: { id: c.id }, data: { status: "scheduled", scheduledAt: c.plannedSendAt, blockedReason: null } });
  await audit(agent.actor, "scheduled", { campaignId: c.id, brandKey: c.brandKey, detail: { scheduledAt: c.plannedSendAt, audienceSize: pf.audienceSize } });
  const fresh = await loadCampaign(c.id);
  return NextResponse.json({ campaign: await campaignView(fresh!) });
});
