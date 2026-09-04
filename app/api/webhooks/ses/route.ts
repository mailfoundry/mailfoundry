import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

/** Validate that a SNS SubscribeURL is genuinely from AWS SNS. */
function isValidSnsSubscribeUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    // Must be HTTPS and hosted on sns.*.amazonaws.com
    return (
      url.protocol === "https:" &&
      /^sns\.[a-z0-9-]+\.amazonaws\.com$/.test(url.hostname)
    );
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.text();
    let sns: Record<string, unknown>;

    try {
      sns = JSON.parse(body);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const messageType = sns["Type"] as string;

    // Handle SNS subscription confirmation
    if (messageType === "SubscriptionConfirmation") {
      const subscribeUrl = sns["SubscribeURL"] as string;
      if (!subscribeUrl || !isValidSnsSubscribeUrl(subscribeUrl)) {
        console.warn("[ses-webhook] Rejected SubscribeURL:", subscribeUrl);
        return NextResponse.json({ error: "Invalid SubscribeURL" }, { status: 400 });
      }
      await fetch(subscribeUrl);
      console.log("[ses-webhook] SNS subscription confirmed:", subscribeUrl);
      return NextResponse.json({ message: "Subscription confirmed" });
    }

    // Handle SNS notifications
    if (messageType === "Notification") {
      let sesMessage: Record<string, unknown>;

      try {
        sesMessage = JSON.parse(sns["Message"] as string);
      } catch {
        return NextResponse.json(
          { error: "Invalid SES message" },
          { status: 400 }
        );
      }

      const notificationType = sesMessage["notificationType"] as string;

      if (notificationType === "Bounce") {
        const bounce = sesMessage["bounce"] as Record<string, unknown>;
        const bounceType = bounce["bounceType"] as string;

        // Only mark permanent bounces — transient bounces (e.g. mailbox full) are temporary
        if (bounceType === "Permanent") {
          const recipients = bounce["bouncedRecipients"] as Array<
            Record<string, string>
          >;

          for (const recipient of recipients) {
            const email = recipient["emailAddress"];
            if (!email) continue;

            await prisma.contact.updateMany({
              where: { email },
              data: { bouncedAt: new Date() },
            });

            console.log(`[ses-webhook] Marked contact as bounced: ${email}`);
          }
        }
      } else if (notificationType === "Complaint") {
        const complaint = sesMessage["complaint"] as Record<string, unknown>;
        const recipients = complaint["complainedRecipients"] as Array<
          Record<string, string>
        >;

        for (const recipient of recipients) {
          const email = recipient["emailAddress"];
          if (!email) continue;

          await prisma.contact.updateMany({
            where: { email },
            data: { complainedAt: new Date() },
          });

          console.log(`[ses-webhook] Marked contact as complained: ${email}`);
        }
      }

      return NextResponse.json({ message: "Notification processed" });
    }

    return NextResponse.json({ message: "Ignored" });
  } catch (error) {
    console.error("[ses-webhook] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
