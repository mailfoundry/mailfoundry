import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

// Queue the campaign for sending via the scheduled cron.
// The cron (/api/cron/send-scheduled) runs every 5 minutes, uses Resend's
// batch API (100 emails/call), and has dedup so re-queuing a partially-sent
// campaign picks up exactly where it left off with no double-sends.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        list: {
          include: { contacts: { include: { contact: true } } },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (!campaign.list) {
      return NextResponse.json(
        { error: "This campaign is not attached to a list." },
        { status: 400 }
      );
    }

    if (!campaign.fromEmail) {
      return NextResponse.json(
        { error: "This campaign does not have a FROM address set. Open the campaign settings and fill in the FROM field before sending." },
        { status: 400 }
      );
    }

    const eligibleContacts = campaign.list.contacts
      .map((c) => c.contact)
      .filter(
        (c) =>
          c.email &&
          c.subscribedAt &&
          !c.unsubscribedAt &&
          !c.archivedAt &&
          !c.bouncedAt &&
          !c.complainedAt
      );

    if (eligibleContacts.length === 0) {
      return NextResponse.json(
        { error: "No eligible contacts found in this campaign list." },
        { status: 400 }
      );
    }

    // Queue: set to scheduled (now) so the cron picks it up within 5 minutes
    await prisma.campaign.update({
      where: { id },
      data: { status: "scheduled", scheduledAt: new Date() },
    });

    return NextResponse.json({ ok: true, queued: true, eligible: eligibleContacts.length });
  } catch (error) {
    console.error("Queue campaign failed:", error);
    return NextResponse.json({ error: "Failed to queue campaign." }, { status: 500 });
  }
}
