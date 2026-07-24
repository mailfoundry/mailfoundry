"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { prisma } from "../../src/lib/prisma";
import { sendEmail } from "../../src/lib/sendEmail";

const IBSA_NOTIFY_EMAIL = "ibsa@xylouk.co.uk";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://ibsa.xylouk.co.uk";

export async function submitGroupOrder(formData: FormData) {
  const groupType       = (formData.get("groupType")       as string).trim();
  const groupName       = (formData.get("groupName")       as string).trim();
  const contactName     = (formData.get("contactName")     as string).trim();
  const contactEmail    = (formData.get("contactEmail")    as string).trim().toLowerCase();
  const contactMobile   = (formData.get("contactMobile")   as string | null)?.trim() || null;
  const deliveryAddress = (formData.get("deliveryAddress") as string | null)?.trim() || null;
  const requiredByDate  = (formData.get("requiredByDate")  as string | null)?.trim() || null;
  const notes           = (formData.get("notes")           as string | null)?.trim() || null;

  const requiredBy = requiredByDate
    ? new Date(requiredByDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;

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

  // ── Upsert GroupAccount ────────────────────────────────────────────────────
  const account = await prisma.groupAccount.upsert({
    where: { contactEmail },
    create: { groupType, groupName, contactEmail, contactName, contactMobile: contactMobile ?? undefined },
    update: { groupName, contactName, contactMobile: contactMobile ?? undefined },
  });

  // ── Generate magic-link token (7 day expiry) ───────────────────────────────
  const rawToken = randomBytes(32).toString("hex");
  await prisma.groupAccountToken.create({
    data: {
      token: rawToken,
      groupAccountId: account.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  const accountUrl = `${BASE_URL}/account/verify?token=${rawToken}`;

  // ── Save order, linked to account ─────────────────────────────────────────
  const order = await prisma.ibsaGroupOrder.create({
    data: {
      groupType,
      groupName,
      contactName,
      contactEmail,
      contactMobile: contactMobile ?? undefined,
      deliveryAddress: deliveryAddress ?? undefined,
      requiredBy: requiredBy ?? undefined,
      notes: notes ?? undefined,
      groupAccountId: account.id,
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

  const fmtGbp = (n: number) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const fmtHtmlLines = (ls: typeof csLines) => ls.map((l) => {
    const lineTotal = l.qty * l.product.unitCost;
    return `<tr>
      <td style="padding:7px 8px;color:#94a3b8;font-size:11px;border-bottom:1px solid #0f172a;font-family:monospace;">${l.product.code}</td>
      <td style="padding:7px 8px;color:#f1f5f9;font-size:13px;border-bottom:1px solid #0f172a;">${l.product.name}${l.product.variant ? `<br><span style="color:#64748b;font-size:11px;">${l.product.variant}</span>` : ""}</td>
      <td style="padding:7px 8px;color:#f1f5f9;font-size:13px;text-align:center;border-bottom:1px solid #0f172a;font-weight:bold;">${l.qty}</td>
      <td style="padding:7px 8px;color:#94a3b8;font-size:12px;text-align:right;border-bottom:1px solid #0f172a;">${fmtGbp(l.product.unitCost)}</td>
      <td style="padding:7px 8px;color:#f1f5f9;font-size:13px;text-align:right;border-bottom:1px solid #0f172a;font-weight:600;">${fmtGbp(lineTotal)}</td>
    </tr>`;
  }).join("");

  const sectionTotal = (ls: typeof csLines) => ls.reduce((s, l) => s + l.qty * l.product.unitCost, 0);

  const sectionHtml = (label: string, ls: typeof csLines) => ls.length === 0 ? "" : `
    <p style="color:#cbd5e1;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:.06em;margin:20px 0 6px;">${label}</p>
    <table style="width:100%;border-collapse:collapse;background:#1e293b;border-radius:8px;overflow:hidden;margin-bottom:4px;">
      <thead><tr style="background:#0f172a;">
        <th style="padding:6px 8px;color:#475569;font-size:10px;text-align:left;text-transform:uppercase;letter-spacing:.05em;width:72px;">Code</th>
        <th style="padding:6px 8px;color:#475569;font-size:10px;text-align:left;text-transform:uppercase;letter-spacing:.05em;">Product</th>
        <th style="padding:6px 8px;color:#475569;font-size:10px;text-align:center;text-transform:uppercase;letter-spacing:.05em;width:36px;">Qty</th>
        <th style="padding:6px 8px;color:#475569;font-size:10px;text-align:right;text-transform:uppercase;letter-spacing:.05em;width:64px;">Unit</th>
        <th style="padding:6px 8px;color:#475569;font-size:10px;text-align:right;text-transform:uppercase;letter-spacing:.05em;width:72px;">Total</th>
      </tr></thead>
      <tbody>${fmtHtmlLines(ls)}</tbody>
      <tfoot><tr>
        <td colspan="4" style="padding:7px 8px;color:#64748b;font-size:12px;text-align:right;border-top:1px solid #0f172a;">Section total</td>
        <td style="padding:7px 8px;color:#f97316;font-size:13px;text-align:right;font-weight:700;border-top:1px solid #0f172a;">${fmtGbp(sectionTotal(ls))}</td>
      </tr></tfoot>
    </table>`;

  const baseHtml = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
      <div style="background:#0f172a;padding:32px;border-radius:12px;">
        <p style="color:#f97316;font-size:16px;font-weight:bold;margin:0 0 4px;">IBSA · Xylo (UK) Ltd</p>`;

  const grandTotal = [...csLines, ...faLines].reduce((s, l) => s + l.qty * l.product.unitCost, 0);

  const grandTotalHtml = `
    <table style="width:100%;border-collapse:collapse;margin-top:4px;">
      <tr>
        <td style="padding:10px 8px;color:#64748b;font-size:13px;text-align:right;border-top:1px solid #1e293b;">Order total</td>
        <td style="padding:10px 8px;color:#f97316;font-size:15px;font-weight:800;text-align:right;border-top:1px solid #1e293b;width:80px;">${fmtGbp(grandTotal)}</td>
      </tr>
    </table>`;

  // ── Notification to IBSA ──────────────────────────────────────────────────
  await sendEmail({
    to: IBSA_NOTIFY_EMAIL,
    subject: `New order — ${groupTypeLabel[groupType] ?? groupType}: ${groupName}`,
    text: `New order from ${groupName} (${groupTypeLabel[groupType] ?? groupType})\nContact: ${contactName} <${contactEmail}>${contactMobile ? `\nMobile: ${contactMobile}` : ""}${requiredBy ? `\nRequired by: ${requiredBy}` : ""}${deliveryAddress ? `\nDelivery: ${deliveryAddress}` : ""}${notes ? `\nNotes: ${notes}` : ""}\n\nCS lines: ${csLines.length} | FA lines: ${faLines.length} | Total: ${fmtGbp(grandTotal)}`,
    html: `${baseHtml}
        <h1 style="color:#fff;font-size:20px;margin:0 0 20px;">New order received</h1>
        <div style="background:#1e293b;border-radius:8px;padding:16px;margin-bottom:4px;">
          <p style="color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:.05em;margin:0 0 2px;">${groupTypeLabel[groupType] ?? groupType}</p>
          <p style="color:#f1f5f9;font-size:16px;font-weight:bold;margin:0 0 10px;">${groupName}</p>
          <p style="color:#94a3b8;font-size:13px;margin:0 0 3px;"><strong style="color:#cbd5e1;">Contact:</strong> ${contactName} · ${contactEmail}${contactMobile ? ` · ${contactMobile}` : ""}</p>
          ${requiredBy ? `<p style="color:#94a3b8;font-size:13px;margin:3px 0 0;"><strong style="color:#cbd5e1;">Required by:</strong> ${requiredBy}</p>` : ""}
          ${deliveryAddress ? `<p style="color:#94a3b8;font-size:13px;margin:3px 0 0;"><strong style="color:#cbd5e1;">Delivery:</strong> ${deliveryAddress.replace(/\n/g, ", ")}</p>` : ""}
          ${notes ? `<p style="color:#94a3b8;font-size:13px;margin:3px 0 0;"><strong style="color:#cbd5e1;">Notes:</strong> ${notes}</p>` : ""}
        </div>
        ${sectionHtml("Cleaning Supplies", csLines)}
        ${sectionHtml("First Aid", faLines)}
        ${grandTotalHtml}
        <p style="color:#475569;font-size:11px;margin:20px 0 0;">Order ID: ${order.id}</p>
      </div>
    </div>`,
  });

  // ── Confirmation + account setup to submitter ──────────────────────────────
  await sendEmail({
    to: contactEmail,
    subject: `Order received — Xylo (UK) Ltd`,
    text: `Hi ${contactName},\n\nThank you — we've received your order for ${groupName}. We'll be in touch to confirm delivery details.\n\nOrder total: ${fmtGbp(grandTotal)}\n\nYour account is ready. Use the link below to view your orders and re-order at any time (link valid 7 days):\n${accountUrl}\n\nQuestions? Email ${IBSA_NOTIFY_EMAIL}.\n\nIBSA · Xylo (UK) Ltd`,
    html: `${baseHtml}
        <h1 style="color:#fff;font-size:20px;margin:0 0 4px;">Order received ✓</h1>
        <p style="color:#94a3b8;font-size:14px;margin:0 0 6px;">Hi ${contactName}, thank you — we've received your order for <strong style="color:#f1f5f9;">${groupName}</strong> and will be in touch to confirm delivery details.</p>
        ${requiredBy ? `<p style="color:#64748b;font-size:12px;margin:0 0 4px;"><strong style="color:#94a3b8;">Required by:</strong> ${requiredBy}</p>` : ""}
        ${deliveryAddress ? `<p style="color:#64748b;font-size:12px;margin:0 0 16px;"><strong style="color:#94a3b8;">Delivery:</strong> ${deliveryAddress.replace(/\n/g, ", ")}</p>` : `<p style="margin:0 0 16px;"></p>`}
        ${sectionHtml("Cleaning Supplies", csLines)}
        ${sectionHtml("First Aid", faLines)}
        ${grandTotalHtml}

        <div style="margin:24px 0 0;padding:20px;background:#1e293b;border-radius:10px;border-left:3px solid #f97316;">
          <p style="color:#f97316;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:.08em;margin:0 0 6px;">Your account</p>
          <p style="color:#94a3b8;font-size:13px;margin:0 0 16px;">View your order history and re-order with one click — no password needed.</p>
          <a href="${accountUrl}" style="display:inline-block;background:#f97316;color:#fff;font-size:13px;font-weight:bold;padding:10px 20px;border-radius:8px;text-decoration:none;">Access your account →</a>
          <p style="color:#475569;font-size:11px;margin:12px 0 0;">Link valid for 7 days. <a href="${BASE_URL}/account/login" style="color:#64748b;">Request a new link</a> any time.</p>
        </div>

        <p style="color:#94a3b8;font-size:13px;margin:20px 0 0;">Questions? Email <a href="mailto:${IBSA_NOTIFY_EMAIL}" style="color:#f97316;">${IBSA_NOTIFY_EMAIL}</a></p>
      </div>
    </div>`,
  });

  redirect(`/order/submitted?name=${encodeURIComponent(groupName)}`);
}
