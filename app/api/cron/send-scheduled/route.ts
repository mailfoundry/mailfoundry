import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { dispatchCampaign } from "@/src/lib/dispatch";

export const maxDuration = 300;

// Called by the Railway cron worker every 5 minutes.
// Branded campaigns are re-checked at send time (approval fingerprint, Hold/Stop, ramp cap, frequency caps).
export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const due = await prisma.campaign.findMany({
    where: { status: "scheduled", scheduledAt: { lte: new Date() } },
    select: { id: true },
  });
  if (due.length === 0) return NextResponse.json({ message: "No campaigns due.", fired: 0 });

  const results: Record<string, unknown> = {};
  for (const { id } of due) {
    // Claim atomically so an overlapping cron run can't double-send
    const claimed = await prisma.campaign.updateMany({ where: { id, status: "scheduled" }, data: { status: "sending" } });
    if (claimed.count === 0) continue;
    const r = await dispatchCampaign(id, "system:cron");
    if (!r.ok && !r.blocked) {
      await prisma.campaign.updateMany({ where: { id, status: "sending" }, data: { status: "failed", blockedReason: r.error ?? null } });
    }
    results[id] = r;
  }
  return NextResponse.json({ message: "Scheduled send complete.", fired: Object.keys(results).length, results });
}
