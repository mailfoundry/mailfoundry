import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { sendEmail } from "@/src/lib/sendEmail";
import { listUnsubscribeHeaders } from "@/src/lib/unsubscribe";
import { applyMergeTags } from "@/src/lib/merge";
import { addEmailFooter, addPreheader, addTextFooter } from "@/src/lib/emailFooter";
import { audit, recordTestSend } from "@/src/lib/brand-rules";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const testEmail = String(body.email || "").trim();

    if (!testEmail) {
      return NextResponse.json(
        { error: "Please enter a test email address." },
        { status: 400 }
      );
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found." },
        { status: 404 }
      );
    }

    const htmlContent =
      campaign.html && campaign.html.trim().length > 0
        ? campaign.html
        : `
          <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            ${campaign.body.replace(/\n/g, "<br />")}
          </div>
        `;

    // Fill merge tags as that contact would see them (falls back to e.g. "there" if not a contact / no name)
    const mergeContact =
      (await prisma.contact.findUnique({
        where: { email: testEmail.toLowerCase() },
        select: { firstName: true, lastName: true, email: true },
      })) ?? { firstName: null, lastName: null, email: testEmail };

    await sendEmail({
      from: campaign.fromEmail ?? undefined,
      to: testEmail,
      subject: applyMergeTags(campaign.subject, mergeContact),
      text: addTextFooter(applyMergeTags(campaign.body, mergeContact), testEmail, campaign.fromEmail),
      // Same footer / branded-unsubscribe handling as real sends
      html: addPreheader(
        addEmailFooter(applyMergeTags(htmlContent, mergeContact, { html: true }), testEmail, campaign.fromEmail),
        campaign.preheader ? applyMergeTags(campaign.preheader, mergeContact, { html: true }) : campaign.preheader
      ),
      // Same one-click unsubscribe headers as real campaign sends, so test results (e.g. mail-tester) match
      headers: listUnsubscribeHeaders(testEmail),
    });

    await recordTestSend(campaign.id);
    await audit("ui", "test_sent", { campaignId: campaign.id, brandKey: campaign.brandKey, detail: { to: testEmail } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Send campaign test failed:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Failed to send test email.";

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
