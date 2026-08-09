import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { addEmailFooter } from "@/src/lib/emailFooter";

// Allow up to 5 minutes on Vercel Pro for large sends
export const maxDuration = 300;

// Called by Vercel Cron every hour
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "RESEND_API_KEY not set" }, { status: 500 });
  }

  const defaultFrom = "IBSA · Xylo Supplies <noreply@xylouk.co.uk>";

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

    if (contacts.length === 0) {
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: "draft", scheduledAt: null },
      });
      continue;
    }

    // ── Build all email payloads with tracking ────────────────────────────────

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

    const payloads: EmailPayload[] = contacts.map((contact) => {
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

    // ── Send in batches of 100 (Resend batch limit) ───────────────────────────

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
              campaignId: campaign.id,
              contactId: p.contactId,
              email: p.email,
              status: "sent",
            });
          }
        } else {
          const errBody = await res.text().catch(() => "unknown");
          for (const p of chunk) {
            sendRecords.push({
              campaignId: campaign.id,
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
            campaignId: campaign.id,
            contactId: p.contactId,
            email: p.email,
            status: "failed",
            error: msg.slice(0, 200),
          });
        }
      }
    }

    // ── Bulk-insert send records ──────────────────────────────────────────────

    await prisma.campaignSend.createMany({ data: sendRecords });

    const sentCount = sendRecords.filter((r) => r.status === "sent").length;

    await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        status: sentCount > 0 ? "sent" : "draft",
        scheduledAt: null,
      },
    });

    fired++;
  }

  return NextResponse.json({ message: "Scheduled send complete.", fired });
}
