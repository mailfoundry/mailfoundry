import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { sendEmail } from "@/src/lib/sendEmail";
import { addEmailFooter } from "@/src/lib/emailFooter";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const body = await request.json().catch(() => ({}));
    const confirmResend = body.confirmResend === true;

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        list: {
          include: {
            contacts: {
              include: {
                contact: true,
              },
            },
          },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    if (
      (campaign.status === "sent" || campaign.status === "partially_sent") &&
      !confirmResend
    ) {
      return NextResponse.json(
        {
          error:
            "This campaign has already been sent. Confirm resend is required before sending it again.",
          requiresResendConfirmation: true,
        },
        { status: 409 }
      );
    }

    if (!campaign.list) {
      return NextResponse.json(
        { error: "This campaign is not attached to a list." },
        { status: 400 }
      );
    }

    const allContacts = campaign.list.contacts
      .map((item) => item.contact)
      .filter((contact) => contact.email);

    if (allContacts.length === 0) {
      return NextResponse.json(
        { error: "No contacts found in this campaign list." },
        { status: 400 }
      );
    }

    const contacts = allContacts.filter(
      (contact) =>
        contact.email &&
        contact.subscribedAt &&
        !contact.unsubscribedAt &&
        !contact.archivedAt &&
        !contact.bouncedAt &&
        !contact.complainedAt
    );

    const skippedUnsubscribedContacts = allContacts.filter(
      (contact) => contact.unsubscribedAt
    );

    const skippedArchivedContacts = allContacts.filter(
      (contact) => !contact.unsubscribedAt && contact.archivedAt
    );

    const skippedBouncedContacts = allContacts.filter(
      (contact) =>
        !contact.unsubscribedAt && !contact.archivedAt && contact.bouncedAt
    );

    const skippedComplainedContacts = allContacts.filter(
      (contact) =>
        !contact.unsubscribedAt &&
        !contact.archivedAt &&
        !contact.bouncedAt &&
        contact.complainedAt
    );

    const skippedUnknownContacts = allContacts.filter(
      (contact) =>
        !contact.subscribedAt &&
        !contact.unsubscribedAt &&
        !contact.archivedAt &&
        !contact.bouncedAt &&
        !contact.complainedAt
    );

    if (contacts.length === 0) {
      return NextResponse.json(
        {
          error:
            "No eligible contacts found in this campaign list. Check for unsubscribed, archived, bounced, complained or unknown contacts.",
        },
        { status: 400 }
      );
    }

    const results = [];

    for (const contact of skippedUnsubscribedContacts) {
      await prisma.campaignSend.create({
        data: {
          campaignId: id,
          contactId: contact.id,
          email: contact.email,
          status: "skipped_unsubscribed",
        },
      });

      results.push({
        email: contact.email,
        status: "skipped_unsubscribed",
      });
    }

    for (const contact of skippedArchivedContacts) {
      await prisma.campaignSend.create({
        data: {
          campaignId: id,
          contactId: contact.id,
          email: contact.email,
          status: "skipped_archived",
        },
      });

      results.push({
        email: contact.email,
        status: "skipped_archived",
      });
    }

    for (const contact of skippedBouncedContacts) {
      await prisma.campaignSend.create({
        data: {
          campaignId: id,
          contactId: contact.id,
          email: contact.email,
          status: "skipped_bounced",
        },
      });

      results.push({
        email: contact.email,
        status: "skipped_bounced",
      });
    }

    for (const contact of skippedComplainedContacts) {
      await prisma.campaignSend.create({
        data: {
          campaignId: id,
          contactId: contact.id,
          email: contact.email,
          status: "skipped_complained",
        },
      });

      results.push({
        email: contact.email,
        status: "skipped_complained",
      });
    }

    for (const contact of skippedUnknownContacts) {
      await prisma.campaignSend.create({
        data: {
          campaignId: id,
          contactId: contact.id,
          email: contact.email,
          status: "skipped_unknown",
        },
      });

      results.push({
        email: contact.email,
        status: "skipped_unknown",
      });
    }

    const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3000";

    for (const contact of contacts) {
      try {
        const baseHtmlContent =
          campaign.html && campaign.html.trim().length > 0
            ? campaign.html
            : `
              <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                ${campaign.body.replace(/\n/g, "<br />")}
              </div>
            `;

        const htmlWithFooter = addEmailFooter(baseHtmlContent, contact.email);

        // Pre-generate the send ID so we can embed it in the tracking pixel
        // before creating the DB record
        const sendId = crypto.randomUUID();
        const pixelUrl = `${appBaseUrl}/api/track/open?s=${sendId}`;
        const pixelTag = `<img src="${pixelUrl}" width="1" height="1" style="display:none" alt="" />`;
        const htmlContent = htmlWithFooter.includes("</body>")
          ? htmlWithFooter.replace("</body>", `${pixelTag}</body>`)
          : `${htmlWithFooter}${pixelTag}`;

        await sendEmail({
          to: contact.email,
          subject: campaign.subject,
          text: campaign.body,
          html: htmlContent,
        });

        await prisma.campaignSend.create({
          data: {
            id: sendId,
            campaignId: id,
            contactId: contact.id,
            email: contact.email,
            status: "sent",
          },
        });

        results.push({
          email: contact.email,
          status: "sent",
        });
      } catch (error) {
        console.error(`Failed to send to ${contact.email}:`, error);

        const errorMessage =
          error instanceof Error ? error.message : String(error);

        await prisma.campaignSend.create({
          data: {
            campaignId: id,
            contactId: contact.id,
            email: contact.email,
            status: "failed",
            error: errorMessage,
          },
        });

        results.push({
          email: contact.email,
          status: "failed",
          error: errorMessage,
        });
      }
    }

    const sentCount = results.filter(
      (result) => result.status === "sent"
    ).length;

    const failedCount = results.filter(
      (result) => result.status === "failed"
    ).length;

    const skippedUnsubscribedCount = results.filter(
      (result) => result.status === "skipped_unsubscribed"
    ).length;

    const skippedArchivedCount = results.filter(
      (result) => result.status === "skipped_archived"
    ).length;

    const skippedBouncedCount = results.filter(
      (result) => result.status === "skipped_bounced"
    ).length;

    const skippedComplainedCount = results.filter(
      (result) => result.status === "skipped_complained"
    ).length;

    const skippedUnknownCount = results.filter(
      (result) => result.status === "skipped_unknown"
    ).length;

    const skippedCount =
      skippedUnsubscribedCount +
      skippedArchivedCount +
      skippedBouncedCount +
      skippedComplainedCount +
      skippedUnknownCount;

    const newStatus =
      sentCount > 0 && failedCount === 0
        ? "sent"
        : sentCount > 0
          ? "partially_sent"
          : "draft";

    await prisma.campaign.update({
      where: { id },
      data: {
        status: newStatus,
      },
    });

    return NextResponse.json({
      message: "Campaign send complete.",
      sent: sentCount,
      failed: failedCount,
      skipped: skippedCount,
      skippedUnsubscribed: skippedUnsubscribedCount,
      skippedArchived: skippedArchivedCount,
      skippedBounced: skippedBouncedCount,
      skippedComplained: skippedComplainedCount,
      skippedUnknown: skippedUnknownCount,
      total: allContacts.length,
      status: newStatus,
      results,
    });
  } catch (error) {
    console.error("Send campaign failed:", error);

    return NextResponse.json(
      { error: "Failed to send campaign." },
      { status: 500 }
    );
  }
}
