"use server";

import { redirect } from "next/navigation";
import { prisma } from "../../src/lib/prisma";
import { sendEmail } from "../../src/lib/sendEmail";

const IBSA_NOTIFY_EMAIL = "ibsa@xylouk.co.uk";

export async function submitGroupOrder(formData: FormData) {
  const groupType       = (formData.get("groupType")       as string).trim();
  const groupName       = (formData.get("groupName")       as string).trim();
  const contactName     = (formData.get("contactName")     as string).trim();
  const contactEmail    = (formData.get("contactEmail")    as string).trim().toLowerCase();
  const contactMobile   = (formData.get("contactMobile")   as string | null)?.trim() || null;
  const deliveryAddress = (formData.get("deliveryAddress") as string | null)?.trim() || null;
  const notes           = (formData.get("notes")           as string | null)?.trim() || null;

  if (!groupType || !groupName || !contactName || !contactEmail) {
    redirect("/order?error=missing-fields");
  }

  // Parse line items: fields named cs_<productId> and fa_<productId>
  const lines: { productId: string; dept: string; qty: number }[] = [];
  for (const [key, value] of formData.entries()) {
    const qty = parseInt(value as string) || 0;
    if (qty <= 0) continue;
    if (key.startsWith("cs_")) lines.push({ productId: key.slice(3), dept: "CS", qty });
    else if (key.startsWith("fa_")) lines.push({ productId: key.slice(3), dept: "FA", qty });
  }

  if (lines.length === 0) redirect("/order?error=no-items");

  // Save to DB
  const order = await prisma.ibsaGroupOrder.create({
    data: {
      groupType,
      groupName,
      contactName,
      contactEmail,
      contactMobile: contactMobile ?? undefined,
      deliveryAddress: deliveryAddress ?? undefined,
      notes: notes ?? undefined,
      lines: { create: lines },
    },
    include: { lines: { include: { product: true } } },
  });

  const groupTypeLabel: Record<string, string> = {
    congregation: "Congregation",
    circuit:      "Circuit Assembly",
    regional:     "Regional",
  };

  const csLines = order.lines.filter((l) => l.dept === "CS");
  const faLines = order.lines.filter((l) => l.dept === "FA");

  const fmtHtmlLines = (ls: typeof csLines) => ls.map((l) => `
    <tr>
      <td style="padding:6px 8px;color:#f1f5f9;font-size:13px;border-bottom:1px solid #1e293b;">${l.product.name}${l.product.variant ? ` <span style="color:#94a3b8;">(${l.product.variant})</span>` : ""}</td>
      <td style="padding:6px 8px;color:#f1f5f9;font-size:13px;text-align:right;border-bottom:1px solid #1e293b;font-weight:bold;">${l.qty}</td>
    </tr>`).join("");

  const sectionHtml = (label: string, ls: typeof csLines) => ls.length === 0 ? "" : `
    <p style="color:#cbd5e1;font-size:13px;font-weight:bold;margin:16px 0 6px;">${label}</p>
    <table style="width:100%;border-collapse:collapse;background:#1e293b;border-radius:8px;overflow:hidden;margin-bottom:8px;">
      <thead><tr>
        <th style="padding:6px 8px;color:#64748b;font-size:11px;text-align:left;text-transform:uppercase;letter-spacing:.05em;">Product</th>
        <th style="padding:6px 8px;color:#64748b;font-size:11px;text-align:right;text-transform:uppercase;letter-spacing:.05em;">Qty</th>
      </tr></thead>
      <tbody>${fmtHtmlLines(ls)}</tbody>
    </table>`;

  const baseHtml = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
      <div style="background:#0f172a;padding:32px;border-radius:12px;">
        <p style="color:#f97316;font-size:16px;font-weight:bold;margin:0 0 4px;">IBSA · Xylo (UK) Ltd</p>`;

  // ── Notification to IBSA ──────────────────────────────────────────────────
  await sendEmail({
    to: IBSA_NOTIFY_EMAIL,
    subject: `New order — ${groupTypeLabel[groupType] ?? groupType}: ${groupName}`,
    text: `New order from ${groupName} (${groupTypeLabel[groupType] ?? groupType})\nContact: ${contactName} <${contactEmail}>${contactMobile ? `\nMobile: ${contactMobile}` : ""}${deliveryAddress ? `\nDelivery: ${deliveryAddress}` : ""}${notes ? `\nNotes: ${notes}` : ""}\n\nCS lines: ${csLines.length} | FA lines: ${faLines.length}`,
    html: `${baseHtml}
        <h1 style="color:#fff;font-size:20px;margin:0 0 20px;">New order received</h1>
        <div style="background:#1e293b;border-radius:8px;padding:16px;margin-bottom:4px;">
          <p style="color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:.05em;margin:0 0 2px;">${groupTypeLabel[groupType] ?? groupType}</p>
          <p style="color:#f1f5f9;font-size:16px;font-weight:bold;margin:0 0 10px;">${groupName}</p>
          <p style="color:#94a3b8;font-size:13px;margin:0 0 3px;"><strong style="color:#cbd5e1;">Contact:</strong> ${contactName} · ${contactEmail}${contactMobile ? ` · ${contactMobile}` : ""}</p>
          ${deliveryAddress ? `<p style="color:#94a3b8;font-size:13px;margin:3px 0 0;"><strong style="color:#cbd5e1;">Delivery:</strong> ${deliveryAddress.replace(/\n/g, ", ")}</p>` : ""}
          ${notes ? `<p style="color:#94a3b8;font-size:13px;margin:3px 0 0;"><strong style="color:#cbd5e1;">Notes:</strong> ${notes}</p>` : ""}
        </div>
        ${sectionHtml("Cleaning Supplies", csLines)}
        ${sectionHtml("First Aid", faLines)}
        <p style="color:#475569;font-size:11px;margin:20px 0 0;">Order ID: ${order.id}</p>
      </div>
    </div>`,
  });

  // ── Confirmation to submitter ─────────────────────────────────────────────
  await sendEmail({
    to: contactEmail,
    subject: `Order received — Xylo (UK) Ltd`,
    text: `Hi ${contactName},\n\nThank you — we've received your order for ${groupName}. We'll be in touch to confirm delivery details.\n\nIf you have any questions contact us at ${IBSA_NOTIFY_EMAIL}.\n\nIBSA · Xylo (UK) Ltd`,
    html: `${baseHtml}
        <h1 style="color:#fff;font-size:20px;margin:0 0 8px;">Order received ✓</h1>
        <p style="color:#94a3b8;font-size:14px;margin:0 0 20px;">Hi ${contactName}, thank you — we've received your order for <strong style="color:#f1f5f9;">${groupName}</strong> and will be in touch to confirm delivery details.</p>
        ${sectionHtml("Cleaning Supplies", csLines)}
        ${sectionHtml("First Aid", faLines)}
        <p style="color:#94a3b8;font-size:13px;margin:20px 0 0;">Questions? Email <a href="mailto:${IBSA_NOTIFY_EMAIL}" style="color:#f97316;">${IBSA_NOTIFY_EMAIL}</a></p>
      </div>
    </div>`,
  });

  redirect(`/order/submitted?name=${encodeURIComponent(groupName)}`);
}
