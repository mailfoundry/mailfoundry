import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { sendEmail } from "@/src/lib/sendEmail";
import { addEmailFooter } from "@/src/lib/emailFooter";

// Called by Vercel Cron every 15 minutes
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  const scheduledCampaigns = await prisma.campaign.findMany({
    where: {
      status: "scheduled",
      scheduledAt: { lte: now },
    },
    include: {
      list: {
        include: {
          contacts: { include: { contact: true } },
        },
      },
    },
  });

  if (scheduledCampaigns.length === 0) {
    return NextResponse.json({ message: "No campaigns due.", fired: 0 });
  }

  const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
  let fired = 0;

  for (const campaign of scheduledCampaigns) {
    const contacts = campaign.list.contacts
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

    let sentCount = 0;

    for (const contact of contacts) {
      try {
        const baseHtml =
          campaign.html?.trim()
            ? campaign.html
            : `<div style="font-family:Arial,sans-serif;line-height:1.6">${campaign.body.replace(/\n/g, "<br/>")}</div>`;

        const htmlWithFooter = addEmailFooter(baseHtml, contact.email);
        const sendId = crypto.randomUUID();

        const htmlWithClicks = htmlWithFooter.replace(
          /<a\s+([^>]*?)href="(https?:\/\/[^"]+)"([^>]*?)>/gi,
          (_m, pre, url, post) =>
            `<a ${pre}href="${appBaseUrl}/api/track/click?s=${sendId}&u=${encodeURIComponent(url)}"${post}>`
        );

        const pixelTag = `<img src="${appBaseUrl}/api/track/open?s=${sendId}" width="1" height="1" style="display:none" alt="" />`;
        const htmlContent = htmlWithClicks.includes("</body>")
          ? htmlWithClicks.replace("</body>", `${pixelTag}</body>`)
          : `${htmlWithClicks}${pixelTag}`;

        await sendEmail({
          to: contact.email,
          subject: campaign.subject,
          text: campaign.body,
          html: htmlContent,
        });

        await prisma.campaignSend.create({
          data: { id: sendId, campaignId: campaign.id, contactId: contact.id, email: contact.email, status: "sent" },
        });

        sentCount++;
      } catch {
        await prisma.campaignSend.create({
          data: { campaignId: campaign.id, contactId: contact.id, email: contact.email, status: "failed" },
        });
      }
    }

    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: sentCount > 0 ? "sent" : "draft", scheduledAt: null },
    });

    fired++;
  }

  return NextResponse.json({ message: "Scheduled send complete.", fired });
}
