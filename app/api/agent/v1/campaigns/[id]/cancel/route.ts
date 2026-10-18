import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { agentRoute, apiError } from "@/src/lib/agent-auth";
import { audit } from "@/src/lib/brand-rules";
import { campaignView, loadCampaign } from "@/src/lib/agent-views";

export const POST = agentRoute<{ id: string }>("campaigns.cancel", async ({ agent, params }) => {
  const c = await loadCampaign(params.id);
  if (!c?.brandKey) return apiError("not_found", "Campaign not found", 404);
  if (["sending", "sent", "cancelled"].includes(c.status)) return apiError("invalid_state", `Campaign is ${c.status}`, 409);
  await prisma.campaign.update({ where: { id: c.id }, data: { status: "cancelled", scheduledAt: null, cancelledAt: new Date() } });
  await audit(agent.actor, "cancelled", { campaignId: c.id, brandKey: c.brandKey });
  const fresh = await loadCampaign(c.id);
  return NextResponse.json({ campaign: await campaignView(fresh!) });
});
