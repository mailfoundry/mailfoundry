import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { dispatchCampaign } from "@/src/lib/dispatch";
import { getMainUser } from "@/src/lib/auth";

// "Send Campaign" button. Sends now via the shared dispatcher (brand rules, approvals and caps apply).
// Dedup via CampaignSend records means re-triggering ("Continue Sending") is safe.
export const maxDuration = 300;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getMainUser();
    if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    const { id } = await params;

    // Lock: only one send at a time per campaign
    const claimed = await prisma.campaign.updateMany({
      where: { id, status: { notIn: ["sending", "cancelled"] } },
      data: { status: "sending" },
    });
    if (claimed.count === 0) {
      return NextResponse.json({ error: "This campaign is already sending, or was cancelled." }, { status: 409 });
    }

    const result = await dispatchCampaign(id, user);
    if (!result.ok) {
      // Put the status back unless the dispatcher set it (blocked)
      await prisma.campaign.updateMany({ where: { id, status: "sending" }, data: { status: "draft" } });
      return NextResponse.json(
        { error: result.blocked ? `Blocked: ${result.blocked.join(" · ")}` : result.error },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: true, sent: result.sent, failed: result.failed, capped: result.capped, eligible: result.sent + result.capped });
  } catch (error) {
    console.error("Send campaign failed:", error);
    return NextResponse.json({ error: "Failed to send campaign." }, { status: 500 });
  }
}
