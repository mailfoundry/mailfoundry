"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "../../src/lib/prisma";
import { sendEmail } from "../../src/lib/sendEmail";

const IBSA_NOTIFY_EMAIL = "ibsa@xylouk.co.uk";

export async function accountLogout() {
  const jar = await cookies();
  jar.delete("group_auth");
  redirect("/account/login");
}

export async function reorder(orderId: string) {
  const jar = await cookies();
  const groupAccountId = jar.get("group_auth")?.value;
  if (!groupAccountId) redirect("/account/login");

  // Fetch original order — must belong to this account
  const original = await prisma.ibsaGroupOrder.findFirst({
    where: { id: orderId, groupAccountId },
    include: { lines: true },
  });

  if (!original || original.lines.length === 0) redirect("/account?error=not-found");

  const account = await prisma.groupAccount.findUnique({ where: { id: groupAccountId } });
  if (!account) redirect("/account/login");

  // Create new order copying lines
  const newOrder = await prisma.ibsaGroupOrder.create({
    data: {
      groupType: original.groupType,
      groupName: original.groupName,
      contactName: original.contactName,
      contactEmail: original.contactEmail,
      contactMobile: original.contactMobile ?? undefined,
      deliveryAddress: original.deliveryAddress ?? undefined,
      groupAccountId,
      lines: {
        create: original.lines.map((l) => ({
          productId: l.productId,
          dept: l.dept,
          qty: l.qty,
        })),
      },
    },
    include: { lines: { include: { product: true } } },
  });

  // Notify IBSA
  const csLines = newOrder.lines.filter((l) => l.dept === "CS");
  const faLines = newOrder.lines.filter((l) => l.dept === "FA");

  const lineText = [...csLines, ...faLines]
    .map((l) => `  ${l.product.name}${l.product.variant ? ` (${l.product.variant})` : ""}: ${l.qty}`)
    .join("\n");

  await sendEmail({
    to: IBSA_NOTIFY_EMAIL,
    subject: `Re-order — ${original.groupName}`,
    text: `Re-order from ${original.groupName}\nContact: ${original.contactName} <${original.contactEmail}>\n\nItems:\n${lineText}\n\nOrder ID: ${newOrder.id}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
        <div style="background:#0f172a;padding:28px;border-radius:12px;">
          <p style="color:#f97316;font-size:14px;font-weight:bold;margin:0 0 4px;">IBSA · Xylo (UK) Ltd</p>
          <h1 style="color:#fff;font-size:18px;margin:0 0 16px;">Re-order received</h1>
          <p style="color:#94a3b8;font-size:13px;margin:0 0 4px;"><strong style="color:#cbd5e1;">${original.groupName}</strong></p>
          <p style="color:#64748b;font-size:12px;margin:0 0 16px;">${original.contactName} · ${original.contactEmail}</p>
          <table style="width:100%;border-collapse:collapse;background:#1e293b;border-radius:8px;overflow:hidden;">
            ${newOrder.lines.map((l) => `<tr><td style="padding:6px 8px;color:#f1f5f9;font-size:13px;border-bottom:1px solid #0f172a;">${l.product.name}${l.product.variant ? ` (${l.product.variant})` : ""}</td><td style="padding:6px 8px;color:#f1f5f9;font-size:13px;text-align:right;border-bottom:1px solid #0f172a;font-weight:bold;">${l.qty}</td></tr>`).join("")}
          </table>
          <p style="color:#475569;font-size:11px;margin:16px 0 0;">Order ID: ${newOrder.id}</p>
        </div>
      </div>`,
  });

  redirect("/account?reordered=1");
}
