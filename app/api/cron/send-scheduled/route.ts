import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { dispatchCampaign } from "@/src/lib/dispatch";
import { audit } from "@/src/lib/brand-rules";

const STUCK_AFTER_MS = 20 * 60_000;

export const maxDuration = 300;

// Called by the Railway cron worker every 5 minutes.
// Branded campaigns are re-checked at send time (approval fingerprint, Hold/Stop, ramp cap, frequency caps).
export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // A send interrupted mid-way (e.g. a platform outage) can be left "sending". After 20 minutes, mark it
  // failed so it's visible and can be re-approved/rescheduled. Never re-sends automatically.
  const stuck = await prisma.campaign.findMany({
    where: { status: "sending", updatedAt: { lt: new Date(Date.now() - STUCK_AFTER_MS) } },
    select: { id: true, brandKey: true, _count: { select: { sends: true } } },
  });
  for (const s of stuck) {
    const reason = s._count.sends === 0
      ? "Send was interrupted before any emails went out — reschedule it (needs final re-approval)"
      : `Send was interrupted after ${s._count.sends} recipients — use Continue Sending to finish (no one gets it twice)`;
    await prisma.campaign.updateMany({ where: { id: s.id, status: "sending" }, data: { status: "failed", scheduledAt: null, blockedReason: reason } });
    await audit("system:cron", "send_interrupted", { campaignId: s.id, brandKey: s.brandKey, detail: { sendsRecorded: s._count.sends } });
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
    try {
      const r = await dispatchCampaign(id, "system:cron");
      if (!r.ok && !r.blocked) {
        await prisma.campaign.updateMany({ where: { id, status: "sending" }, data: { status: "failed", blockedReason: r.error ?? null } });
        await audit("system:cron", "send_failed", { campaignId: id, detail: { error: r.error ?? null } });
      }
      results[id] = r;
    } catch (err) {
      const msg = (err instanceof Error ? err.message : String(err)).slice(0, 500);
      await prisma.campaign.updateMany({ where: { id, status: "sending" }, data: { status: "failed", blockedReason: `Send error: ${msg}` } }).catch(() => {});
      await audit("system:cron", "send_failed", { campaignId: id, detail: { error: msg } });
      results[id] = { ok: false, error: msg };
    }
  }
  return NextResponse.json({ message: "Scheduled send complete.", fired: Object.keys(results).length, results });
}
