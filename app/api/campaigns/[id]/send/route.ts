import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { sendEmail } from "@/src/lib/sendEmail";
import { addEmailFooter } from "@/src/lib/emailFooter";

export const maxDuration = 300; // 5 minutes (Vercel Pro max)

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

    // M-2: Prevent concurrent sends — only one send may run at a time
    if (campaign.status === "sending") {
      return NextResponse.json(
        { error: "This campaign is already being sent. Please wait for the current send to complete." },
        { status: 409 }
      );
    }

    // Lock: mark as "sending" before any work begins
    await prisma.campaign.update({ where: { id }, data: { status: "sending" } });

    if (!campaign.list) {
      return NextResponse.json(
        { error: "This campaign is not attached to a list." },
        { status: 400 }
      );
    }

    if (!campaign.fromEmail) {
      return NextResponse.json(
        {
          error:
            "This campaign does not have a FROM address set. Open the campaign settings and fill in the FROM field before sending.",
        },
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

    // M-4: Batch-insert all skipped records in one query per status
    const skippedGroups: Array<{ contacts: typeof skippedUnsubscribedContacts; status: string }> = [
      { contacts: skippedUnsubscribedContacts, status: "skipped_unsubscribed" },
      { contacts: skippedArchivedContacts,     status: "skipped_archived" },
      { contacts: skippedBouncedContacts,      status: "skipped_bounced" },
      { contacts: skippedComplainedContacts,   status: "skipped_complained" },
      { contacts: skippedUnknownContacts,      status: "skipped_unknown" },
    ];

    for (const { contacts: grp, status } of skippedGroups) {
      if (grp.length === 0) continue;
      await prisma.campaignSend.createMany({
        data: grp.map((c) => ({ campaignId: id, contactId: c.id, email: c.email, status })),
        skipDuplicates: true,
      });
      for (const c of grp) results.push({ email: c.email, status });
    }

    const appBaseUrl = process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "https://ibsa.xylouk.co.uk";

    // Always skip contacts who already received this campaign successfully
    const alreadySentEmails = new Set(
      (
        await prisma.campaignSend.findMany({
          where: { campaignId: id, status: "sent" },
          select: { email: true },
        })
      ).map((r) => r.email)
    );

    const contactsToSend = contacts.filter(
      (contact) => !alreadySentEmails.has(contact.email)
    );

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    for (const contact of contactsToSend) {
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

        // Pre-generate the send ID so we can embed tracking before the DB record
        const sendId = crypto.randomUUID();

        // Rewrite all <a href="..."> links through the click tracker
        const htmlWithClicks = htmlWithFooter.replace(
          /<a\s+([^>]*?)href="(https?:\/\/[^"]+)"([^>]*?)>/gi,
          (_match, pre, url, post) => {
            const tracked = `${appBaseUrl}/api/track/click?s=${sendId}&u=${encodeURIComponent(url)}`;
            return `<a ${pre}href="${tracked}"${post}>`;
          }
        );

        // Inject open tracking pixel
        const pixelUrl = `${appBaseUrl}/api/track/open?s=${sendId}`;
        const pixelTag = `<img src="${pixelUrl}" width="1" height="1" style="display:none" alt="" />`;
        const htmlContent = htmlWithClicks.includes("</body>")
          ? htmlWithClicks.replace("</body>", `${pixelTag}</body>`)
          : `${htmlWithClicks}${pixelTag}`;

        await sendEmail({
          from: campaign.fromEmail ?? undefined,
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

        // Stay under Resend's 10 req/sec rate limit
        await sleep(110);
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

    // Count how many eligible contacts still haven't been successfully sent to
    const totalSentForCampaign = await prisma.campaignSend.count({
      where: { campaignId: id, status: "sent" },
    });
    const remaining = Math.max(0, contacts.length - totalSentForCampaign);

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
      remaining,
      status: newStatus,
      results,
    });
  } catch (error) {
    console.error("Send campaign failed:", error);

    // Release the "sending" lock on unexpected failure so the user can retry
    try {
      const { id: eid } = await params;
      await prisma.campaign.update({
        where: { id: eid },
        data: { status: "draft" },
      });
    } catch { /* best-effort */ }

    return NextResponse.json(
      { error: "Failed to send campaign." },
      { status: 500 }
    );
  }
}
