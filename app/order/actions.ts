"use server";

import { redirect } from "next/navigation";
import { prisma } from "../../src/lib/prisma";
import { sendEmail } from "../../src/lib/sendEmail";

export type OrderLines = Record<string, number>; // productId → qty

export async function submitGroupOrder(formData: FormData) {
  const groupType    = (formData.get("groupType") as string).trim();
  const groupName    = (formData.get("groupName") as string).trim();
  const contactName  = (formData.get("contactName") as string).trim();
  const contactEmail = (formData.get("contactEmail") as string).trim().toLowerCase();
  const contactMobile = (formData.get("contactMobile") as string | null)?.trim() || null;

  if (!groupType || !groupName || !contactName || !contactEmail) {
    redirect("/order?error=missing-fields");
  }

  // Parse line items: fields named cs_<productId> and fa_<productId>
  const lines: { productId: string; dept: string; qty: number }[] = [];
  for (const [key, value] of formData.entries()) {
    const qty = parseInt(value as string) || 0;
    if (qty <= 0) continue;
    if (key.startsWith("cs_")) {
      lines.push({ productId: key.slice(3), dept: "CS", qty });
    } else if (key.startsWith("fa_")) {
      lines.push({ productId: key.slice(3), dept: "FA", qty });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const order = await (prisma as any).ibsaGroupOrder.create({
    data: {
      groupType,
      groupName,
      contactName,
      contactEmail,
      contactMobile,
      lines: {
        create: lines,
      },
    },
  });

  // Send confirmation email to the overseer
  const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
  const csLines = lines.filter((l) => l.dept === "CS");
  const faLines = lines.filter((l) => l.dept === "FA");

  await sendEmail({
    to: contactEmail,
    subject: `Order received — ${groupName}`,
    text: `Hi ${contactName},\n\nWe've received your order for ${groupName}.\n\nCS lines: ${csLines.length}\nFA lines: ${faLines.length}\n\nWe'll be in touch soon.\n\nIBSA · Xylo Supplies`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;">
        <div style="background:#0f172a;padding:32px;border-radius:12px;">
          <p style="color:#f97316;font-size:18px;font-weight:bold;margin:0 0 8px;">IBSA · Xylo Supplies</p>
          <h1 style="color:#fff;font-size:22px;margin:0 0 16px;">Order received</h1>
          <div style="background:#1e293b;border-radius:8px;padding:16px;margin-bottom:20px;">
            <p style="color:#94a3b8;font-size:12px;margin:0 0 2px;">${groupType.charAt(0).toUpperCase() + groupType.slice(1)}</p>
            <p style="color:#f1f5f9;font-size:16px;font-weight:bold;margin:0 0 8px;">${groupName}</p>
            <p style="color:#94a3b8;font-size:13px;margin:0;">
              ${csLines.length > 0 ? `Cleaning Supplies: <strong style="color:#fff;">${csLines.length} product${csLines.length !== 1 ? "s" : ""}</strong>` : ""}
              ${csLines.length > 0 && faLines.length > 0 ? " &nbsp;·&nbsp; " : ""}
              ${faLines.length > 0 ? `First Aid: <strong style="color:#fff;">${faLines.length} product${faLines.length !== 1 ? "s" : ""}</strong>` : ""}
            </p>
          </div>
          <p style="color:#94a3b8;margin:0 0 4px;">Hi ${contactName},</p>
          <p style="color:#94a3b8;margin:0 0 20px;">Thank you — we've received your order and will be in touch shortly.</p>
          <p style="color:#475569;font-size:12px;margin:0;">IBSA · Xylo Supplies</p>
        </div>
      </div>
    `,
  });

  redirect(`/order/submitted?name=${encodeURIComponent(groupName)}`);
}
