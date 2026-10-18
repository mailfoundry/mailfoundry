import { NextResponse } from "next/server";
import { agentRoute, apiError } from "@/src/lib/agent-auth";
import { campaignStats, loadCampaign } from "@/src/lib/agent-views";

export const GET = agentRoute<{ id: string }>("campaigns.stats", async ({ params }) => {
  const c = await loadCampaign(params.id);
  if (!c?.brandKey) return apiError("not_found", "Campaign not found", 404);
  return NextResponse.json({ campaignId: c.id, status: c.status, stats: await campaignStats(c.id) });
});
