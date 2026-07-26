"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "../../src/lib/prisma";
import { sendEmail } from "../../src/lib/sendEmail";

const IBSA_NOTIFY_EMAIL = "ibsa@xylouk.co.uk";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://ibsa.xylouk.co.uk";

export async function accountLogout() {
  const jar = await cookies();
  jar.delete("group_auth");
  redirect("/account/login");
}

export async function reorder(orderId: string, formData: FormData) {
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

  // Form fields
  const requiredByDate  = formData.get("requiredByDate") as string | null;
  const deliveryAddress = (formData.get("deliveryAddress") as string | null)?.trim() || original.deliveryAddress;
  const paymentMethod   = (formData.get("paymentMethod")   as string | null)?.trim() || null;
  const contactMobile   = (formData.get("contactMobile")   as string | null)?.trim() || original.contactMobile;
  const notes           = (formData.get("notes")           as string | null)?.trim() || null;
  const requiredBy = requiredByDate
    ? new Date(requiredByDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;

  // Create new order copying lines
  const newOrder = await prisma.ibsaGroupOrder.create({
    data: {
      groupType: original.groupType,
      groupName: original.groupName,
      contactName: original.contactName,
      contactEmail: original.contactEmail,
      contactMobile: contactMobile ?? undefined,
      notes: notes ?? undefined,
      deliveryAddress: deliveryAddress ?? undefined,
      requiredBy: requiredBy ?? undefined,
      paymentMethod: paymentMethod ?? undefined,
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

  // ── Shared helpers ────────────────────────────────────────────────────────────
  const csLines = newOrder.lines.filter((l) => l.dept === "CS");
  const faLines = newOrder.lines.filter((l) => l.dept === "FA");
  const grandTotal = newOrder.lines.reduce((s, l) => s + l.qty * l.product.unitCost, 0);
  const fmtGbp = (n: number) => "£" + n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const fmtHtmlLines = (ls: typeof csLines) => ls.map((l) => `
    <tr>
      <td style="padding:7px 8px;color:#1e293b;font-size:13px;border-bottom:1px solid #f1f5f9;">${l.product.name}${l.product.variant ? `<br><span style="color:#94a3b8;font-size:11px;">${l.product.variant}</span>` : ""}</td>
      <td style="padding:7px 8px;color:#1e293b;font-size:13px;text-align:center;border-bottom:1px solid #f1f5f9;font-weight:bold;">${l.qty}</td>
      <td style="padding:7px 8px;color:#64748b;font-size:12px;text-align:right;border-bottom:1px solid #f1f5f9;">${fmtGbp(l.product.unitCost)}</td>
      <td style="padding:7px 8px;color:#1e293b;font-size:13px;text-align:right;border-bottom:1px solid #f1f5f9;font-weight:600;">${fmtGbp(l.qty * l.product.unitCost)}</td>
    </tr>`).join("");

  const sectionTotal = (ls: typeof csLines) => ls.reduce((s, l) => s + l.qty * l.product.unitCost, 0);

  const sectionHtml = (label: string, ls: typeof csLines) => ls.length === 0 ? "" : `
    <p style="color:#64748b;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:.06em;margin:20px 0 6px;">${label}</p>
    <table style="width:100%;border-collapse:collapse;background:#ffffff;border-radius:8px;overflow:hidden;margin-bottom:4px;border:1px solid #e2e8f0;">
      <thead><tr style="background:#f8fafc;">
        <th style="padding:6px 8px;color:#94a3b8;font-size:10px;text-align:left;text-transform:uppercase;letter-spacing:.05em;">Product</th>
        <th style="padding:6px 8px;color:#94a3b8;font-size:10px;text-align:center;text-transform:uppercase;letter-spacing:.05em;width:36px;">Qty</th>
        <th style="padding:6px 8px;color:#94a3b8;font-size:10px;text-align:right;text-transform:uppercase;letter-spacing:.05em;width:64px;">Unit</th>
        <th style="padding:6px 8px;color:#94a3b8;font-size:10px;text-align:right;text-transform:uppercase;letter-spacing:.05em;width:72px;">Total</th>
      </tr></thead>
      <tbody>${fmtHtmlLines(ls)}</tbody>
      <tfoot><tr>
        <td colspan="3" style="padding:7px 8px;color:#94a3b8;font-size:12px;text-align:right;border-top:1px solid #f1f5f9;">Section total</td>
        <td style="padding:7px 8px;color:#f97316;font-size:13px;text-align:right;font-weight:700;border-top:1px solid #f1f5f9;">${fmtGbp(sectionTotal(ls))}</td>
      </tr></tfoot>
    </table>`;

  const grandTotalHtml = `
    <table style="width:100%;border-collapse:collapse;margin-top:4px;">
      <tr>
        <td style="padding:10px 8px;color:#94a3b8;font-size:13px;text-align:right;border-top:1px solid #e2e8f0;">Order total</td>
        <td style="padding:10px 8px;color:#f97316;font-size:15px;font-weight:800;text-align:right;border-top:1px solid #e2e8f0;width:80px;">${fmtGbp(grandTotal)}</td>
      </tr>
    </table>`;

  const baseHtml = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;padding:8px;">
      <div style="background:#ffffff;padding:32px;border-radius:12px;border:1px solid #e2e8f0;">
        <p style="color:#f97316;font-size:16px;font-weight:bold;margin:0 0 4px;">IBSA · Xylo (UK) Ltd</p>`;

  const lineText = [...csLines, ...faLines]
    .map((l) => `  ${l.product.name}${l.product.variant ? ` (${l.product.variant})` : ""}: ${l.qty}`)
    .join("\n");

  const paymentLabel: Record<string, string> = { bacs: "BACS Transfer", card: "Credit / Debit Card", po: "Purchase Order" };

  // ── Notify IBSA ───────────────────────────────────────────────────────────────
  await sendEmail({
    to: IBSA_NOTIFY_EMAIL,
    subject: `Re-order — ${original.groupName}`,
    text: `Re-order from ${original.groupName}\nContact: ${original.contactName} <${original.contactEmail}>${contactMobile ? `\nMobile: ${contactMobile}` : ""}${requiredBy ? `\nRequired by: ${requiredBy}` : ""}${deliveryAddress ? `\nDelivery: ${deliveryAddress}` : ""}${paymentMethod ? `\nPayment: ${paymentLabel[paymentMethod] ?? paymentMethod}` : ""}${notes ? `\nNotes: ${notes}` : ""}\n\nItems:\n${lineText}\n\nTotal: ${fmtGbp(grandTotal)}\nOrder ID: ${newOrder.id}`,
    html: `${baseHtml}
        <h1 style="color:#0f172a;font-size:20px;margin:0 0 20px;">Re-order received</h1>
        <div style="background:#f8fafc;border-radius:8px;padding:16px;margin-bottom:4px;border:1px solid #e2e8f0;">
          <p style="color:#0f172a;font-size:16px;font-weight:bold;margin:0 0 10px;">${original.groupName}</p>
          <p style="color:#64748b;font-size:13px;margin:0 0 3px;"><strong style="color:#1e293b;">Contact:</strong> ${original.contactName} · ${original.contactEmail}${contactMobile ? ` · ${contactMobile}` : ""}</p>
          ${requiredBy ? `<p style="color:#64748b;font-size:13px;margin:3px 0 0;"><strong style="color:#1e293b;">Required by:</strong> ${requiredBy}</p>` : ""}
          ${deliveryAddress ? `<p style="color:#64748b;font-size:13px;margin:3px 0 0;"><strong style="color:#1e293b;">Delivery:</strong> ${String(deliveryAddress).replace(/\n/g, ", ")}</p>` : ""}
          ${paymentMethod ? `<p style="color:#64748b;font-size:13px;margin:3px 0 0;"><strong style="color:#1e293b;">Payment:</strong> ${paymentLabel[paymentMethod] ?? paymentMethod}</p>` : ""}
          ${notes ? `<p style="color:#64748b;font-size:13px;margin:3px 0 0;"><strong style="color:#1e293b;">Notes:</strong> ${notes}</p>` : ""}
        </div>
        ${sectionHtml("Cleaning Supplies", csLines)}
        ${sectionHtml("First Aid", faLines)}
        ${grandTotalHtml}
        <p style="color:#94a3b8;font-size:11px;margin:20px 0 0;">Order ID: ${newOrder.id}</p>
      </div>
    </div>`,
  });

  // ── Confirmation to customer ───────────────────────────────────────────────────
  await sendEmail({
    to: original.contactEmail,
    subject: `Re-order received — Xylo (UK) Ltd`,
    text: `Hi ${original.contactName},\n\nThank you — we've received your re-order for ${original.groupName}. We'll be in touch to confirm delivery details.${requiredBy ? `\n\nRequired by: ${requiredBy}` : ""}${deliveryAddress ? `\nDelivery: ${deliveryAddress}` : ""}\n\nOrder total: ${fmtGbp(grandTotal)}\n\nQuestions? Email ${IBSA_NOTIFY_EMAIL}.\n\nIBSA · Xylo (UK) Ltd`,
    html: `${baseHtml}
        <h1 style="color:#0f172a;font-size:20px;margin:0 0 4px;">Re-order received ✓</h1>
        <p style="color:#64748b;font-size:14px;margin:0 0 6px;">Hi ${original.contactName}, thank you — we've received your re-order for <strong style="color:#1e293b;">${original.groupName}</strong> and will be in touch to confirm delivery details.</p>
        ${requiredBy ? `<p style="color:#94a3b8;font-size:12px;margin:0 0 4px;"><strong style="color:#64748b;">Required by:</strong> ${requiredBy}</p>` : ""}
        ${deliveryAddress ? `<p style="color:#94a3b8;font-size:12px;margin:0 0 16px;"><strong style="color:#64748b;">Delivery:</strong> ${String(deliveryAddress).replace(/\n/g, ", ")}</p>` : `<p style="margin:0 0 16px;"></p>`}
        ${sectionHtml("Cleaning Supplies", csLines)}
        ${sectionHtml("First Aid", faLines)}
        ${grandTotalHtml}
        <p style="color:#64748b;font-size:13px;margin:20px 0 0;">Questions? Email <a href="mailto:${IBSA_NOTIFY_EMAIL}" style="color:#f97316;">${IBSA_NOTIFY_EMAIL}</a></p>

        <!-- Account banner -->
        <div style="margin-top:24px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;padding:20px 20px 16px;">
          <p style="color:#0f172a;font-size:14px;font-weight:bold;margin:0 0 4px;">Your Xylo account</p>
          <p style="color:#64748b;font-size:13px;margin:0 0 12px;">We've saved your order to your Xylo account. From there you can:</p>
          <table style="border-collapse:collapse;width:100%;margin-bottom:14px;">
            <tr><td style="padding:2px 0;color:#0f172a;font-size:13px;vertical-align:top;width:20px;">✓</td><td style="padding:2px 0;color:#1e293b;font-size:13px;">View your order details and current status</td></tr>
            <tr><td style="padding:2px 0;color:#0f172a;font-size:13px;vertical-align:top;">✓</td><td style="padding:2px 0;color:#1e293b;font-size:13px;">Re-order previous items with a single click</td></tr>
            <tr><td style="padding:2px 0;color:#0f172a;font-size:13px;vertical-align:top;">✓</td><td style="padding:2px 0;color:#1e293b;font-size:13px;">See your full order history across all events</td></tr>
          </table>
          <a href="${BASE_URL}/account" style="display:inline-block;background:#f97316;color:#ffffff;font-size:13px;font-weight:bold;text-decoration:none;padding:9px 18px;border-radius:7px;">Access your account →</a>
          <p style="color:#94a3b8;font-size:11px;margin:14px 0 0;">🔒 No password needed, and nothing to guess. Your link is unique to you, expires in 7 days, and works only once — so your account stays private even if this email is ever forwarded. Request a new link any time.</p>
        </div>
      </div>
    </div>`,
  });

  redirect("/account?reordered=1");
}
