import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { sendEmail } from "@/src/lib/sendEmail";

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

    await sendEmail({
      to: testEmail,
      subject: campaign.subject,
      text: campaign.body,
      html: htmlContent,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Send campaign test failed:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Failed to send test email.";

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
