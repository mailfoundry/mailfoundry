import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { addEmailFooter } from "@/src/lib/emailFooter";

// Immediately dispatches a campaign via Resend batch API.
// Dedup via CampaignSend records means re-triggering is safe.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "RESEND_API_KEY not set" }, { status: 500 });
    }

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

    // Dedup: skip contacts already successfully sent this campaign
    const alreadySentEmails = new Set(
      (
        await prisma.campaignSend.findMany({
          where: { campaignId: id, status: "sent" },
          select: { email: true },
        })
      ).map((r) => r.email)
    );
    const contactsToSend = eligibleContacts.filter(
      (c) => !alreadySentEmails.has(c.email)
    );

    if (contactsToSend.length === 0) {
      await prisma.campaign.update({
        where: { id },
        data: { status: "sent", scheduledAt: null },
      });
      return NextResponse.json({ ok: true, sent: 0, message: "Already fully sent." });
    }

    // Mark as sending immediately so UI shows progress
    await prisma.campaign.update({
      where: { id },
      data: { status: "sending", scheduledAt: null },
    });

    const appBaseUrl =
      process.env.APP_BASE_URL ??
      process.env.NEXT_PUBLIC_BASE_URL ??
      "https://ibsa.xylouk.co.uk";

    const defaultFrom = "IBSA · Xylo Supplies <noreply@xylouk.co.uk>";

    type EmailPayload = {
      sendId: string;
      contactId: string;
      email: string;
      resendPayload: {
        from: string;
        to: string;
        subject: string;
        text: string;
        html: string;
      };
    };

    const payloads: EmailPayload[] = contactsToSend.map((contact) => {
      const sendId = crypto.randomUUID();

      const baseHtml =
        campaign.html?.trim()
          ? campaign.html
          : `<div style="font-family:Arial,sans-serif;line-height:1.6">${campaign.body.replace(/\n/g, "<br/>")}</div>`;

      const htmlWithFooter = addEmailFooter(baseHtml, contact.email);

      const htmlWithClicks = htmlWithFooter.replace(
        /<a\s+([^>]*?)href="(https?:\/\/[^"]+)"([^>]*?)>/gi,
        (_m, pre, url, post) =>
          `<a ${pre}href="${appBaseUrl}/api/track/click?s=${sendId}&u=${encodeURIComponent(url)}"${post}>`
      );

      const pixelTag = `<img src="${appBaseUrl}/api/track/open?s=${sendId}" width="1" height="1" style="display:none" alt="" />`;
      const htmlContent = htmlWithClicks.includes("</body>")
        ? htmlWithClicks.replace("</body>", `${pixelTag}</body>`)
        : `${htmlWithClicks}${pixelTag}`;

      return {
        sendId,
        contactId: contact.id,
        email: contact.email,
        resendPayload: {
          from: campaign.fromEmail ?? defaultFrom,
          to: contact.email,
          subject: campaign.subject,
          text: campaign.body,
          html: htmlContent,
        },
      };
    });

    // Send in batches of 100 (Resend batch limit)
    const BATCH_SIZE = 100;
    const sendRecords: {
      id?: string;
      campaignId: string;
      contactId: string;
      email: string;
      status: string;
      error?: string;
    }[] = [];

    for (let i = 0; i < payloads.length; i += BATCH_SIZE) {
      const chunk = payloads.slice(i, i + BATCH_SIZE);

      try {
        const res = await fetch("https://api.resend.com/emails/batch", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(chunk.map((p) => p.resendPayload)),
        });

        if (res.ok) {
          for (const p of chunk) {
            sendRecords.push({
              id: p.sendId,
              campaignId: id,
              contactId: p.contactId,
              email: p.email,
              status: "sent",
            });
          }
        } else {
          const errBody = await res.text().catch(() => "unknown");
          for (const p of chunk) {
            sendRecords.push({
              campaignId: id,
              contactId: p.contactId,
              email: p.email,
              status: "failed",
              error: `Batch error ${res.status}: ${errBody}`.slice(0, 200),
            });
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        for (const p of chunk) {
          sendRecords.push({
            campaignId: id,
            contactId: p.contactId,
            email: p.email,
            status: "failed",
            error: msg.slice(0, 200),
          });
        }
      }
    }

    await prisma.campaignSend.createMany({ data: sendRecords });

    const sentCount = sendRecords.filter((r) => r.status === "sent").length;

    await prisma.campaign.update({
      where: { id },
      data: {
        status: sentCount > 0 ? "sent" : "draft",
        scheduledAt: null,
      },
    });

    return NextResponse.json({ ok: true, sent: sentCount, failed: sendRecords.length - sentCount });
  } catch (error) {
    console.error("Send campaign failed:", error);
    return NextResponse.json({ error: "Failed to send campaign." }, { status: 500 });
  }
}
