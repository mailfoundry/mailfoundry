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
  const paymentMethod   = (formData.get("paymentMethod")   as string | null)?.trim() || null;

  const requiredBy = requiredByDate
    ? new Date(requiredByDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;

  if (!groupType || !groupName || !contactName || !contactEmail || !contactMobile || !deliveryAddress) {
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
      paymentMethod: paymentMethod ?? undefined,
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

  const EMAIL_CATEGORY_LABELS: Record<string, string> = {
    safety_ppe: "Safety & PPE", janitorial: "Janitorial", chemicals: "Cleaning Chemicals",
    special: "Special Order", firstaid: "First Aid", gloves: "Gloves",
    hivis: "Hi Vis", brushes: "Brushes", mops: "Mops",
  };

  const fmtHtmlLines = (ls: typeof csLines) => ls.map((l) => {
    const lineTotal = l.qty * l.product.unitCost;
    return `<tr>
      <td style="padding:7px 8px;color:#1e293b;font-size:13px;border-bottom:1px solid #f1f5f9;">${l.product.name}${l.product.variant ? `<br><span style="color:#94a3b8;font-size:11px;">${l.product.variant}</span>` : ""}</td>
      <td style="padding:7px 8px;color:#1e293b;font-size:13px;text-align:center;border-bottom:1px solid #f1f5f9;font-weight:bold;">${l.qty}</td>
      <td style="padding:7px 8px;color:#64748b;font-size:12px;text-align:right;border-bottom:1px solid #f1f5f9;">${fmtGbp(l.product.unitCost)}</td>
      <td style="padding:7px 8px;color:#1e293b;font-size:13px;text-align:right;border-bottom:1px solid #f1f5f9;font-weight:600;">${fmtGbp(lineTotal)}</td>
    </tr>`;
  }).join("");

  const sectionTotal = (ls: typeof csLines) => ls.reduce((s, l) => s + l.qty * l.product.unitCost, 0);

  const sectionHtml = (label: string, ls: typeof csLines) => {
    if (ls.length === 0) return "";
    // Group by category, sorted by label
    const byCat = new Map<string, typeof csLines>();
    for (const l of ls) { const c = l.product.category; if (!byCat.has(c)) byCat.set(c, []); byCat.get(c)!.push(l); }
    const sorted = [...byCat.entries()].sort(([a], [b]) => (EMAIL_CATEGORY_LABELS[a] ?? a).localeCompare(EMAIL_CATEGORY_LABELS[b] ?? b));
    const multiCat = sorted.length > 1;
    const bodyRows = sorted.map(([cat, catLines]) => {
      const catHeader = multiCat ? `<tr><td colspan="4" style="padding:5px 8px;background:#f8fafc;color:#94a3b8;font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:.07em;border-bottom:1px solid #f1f5f9;">${EMAIL_CATEGORY_LABELS[cat] ?? cat}</td></tr>` : "";
      return catHeader + fmtHtmlLines(catLines);
    }).join("");
    return `
    <p style="color:#64748b;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:.06em;margin:20px 0 6px;">${label}</p>
    <table style="width:100%;border-collapse:collapse;background:#ffffff;border-radius:8px;overflow:hidden;margin-bottom:4px;border:1px solid #e2e8f0;">
      <thead><tr style="background:#f8fafc;">
        <th style="padding:6px 8px;color:#94a3b8;font-size:10px;text-align:left;text-transform:uppercase;letter-spacing:.05em;">Product</th>
        <th style="padding:6px 8px;color:#94a3b8;font-size:10px;text-align:center;text-transform:uppercase;letter-spacing:.05em;width:36px;">Qty</th>
        <th style="padding:6px 8px;color:#94a3b8;font-size:10px;text-align:right;text-transform:uppercase;letter-spacing:.05em;width:64px;">Unit</th>
        <th style="padding:6px 8px;color:#94a3b8;font-size:10px;text-align:right;text-transform:uppercase;letter-spacing:.05em;width:72px;">Total</th>
      </tr></thead>
      <tbody>${bodyRows}</tbody>
      <tfoot><tr>
        <td colspan="3" style="padding:7px 8px;color:#94a3b8;font-size:12px;text-align:right;border-top:1px solid #f1f5f9;">Section total</td>
        <td style="padding:7px 8px;color:#f97316;font-size:13px;text-align:right;font-weight:700;border-top:1px solid #f1f5f9;">${fmtGbp(sectionTotal(ls))}</td>
      </tr></tfoot>
    </table>`;
  };

  const baseHtml = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;padding:8px;">
      <div style="background:#ffffff;padding:32px;border-radius:12px;border:1px solid #e2e8f0;">
        <p style="color:#f97316;font-size:16px;font-weight:bold;margin:0 0 4px;">IBSA · Xylo (UK) Ltd</p>`;

  const emailFooterHtml = `
    <div style="margin-top:28px;padding-top:16px;border-top:1px solid #f1f5f9;text-align:center;">
      <p style="color:#f97316;font-size:13px;font-weight:bold;margin:0 0 4px;">Xylo (UK) Ltd</p>
      <p style="color:#94a3b8;font-size:11px;margin:0 0 2px;line-height:1.6;">R08 Regent Works Studio, Regent Works, Lawley Street, Longton, Staffs. ST3 1LZ</p>
      <p style="color:#94a3b8;font-size:11px;margin:0;line-height:1.6;">Co. Reg: GB:073 23863 &nbsp;&middot;&nbsp; VAT Reg No: 442 8892 61</p>
    </div>`;

  const grandTotal = [...csLines, ...faLines].reduce((s, l) => s + l.qty * l.product.unitCost, 0);

  const vat = grandTotal * 0.2;
  const grandTotalHtml = `
    <table style="width:100%;border-collapse:collapse;margin-top:4px;">
      <tr>
        <td style="padding:7px 8px;color:#94a3b8;font-size:12px;text-align:right;border-top:1px solid #e2e8f0;">Subtotal (ex VAT)</td>
        <td style="padding:7px 8px;color:#64748b;font-size:12px;text-align:right;border-top:1px solid #e2e8f0;width:80px;">${fmtGbp(grandTotal)}</td>
      </tr>
      <tr>
        <td style="padding:7px 8px;color:#94a3b8;font-size:12px;text-align:right;">VAT (20%)</td>
        <td style="padding:7px 8px;color:#64748b;font-size:12px;text-align:right;">${fmtGbp(vat)}</td>
      </tr>
      <tr>
        <td style="padding:10px 8px;color:#94a3b8;font-size:13px;text-align:right;border-top:1px solid #e2e8f0;font-weight:600;">Total (inc VAT)</td>
        <td style="padding:10px 8px;color:#f97316;font-size:15px;font-weight:800;text-align:right;border-top:1px solid #e2e8f0;">${fmtGbp(grandTotal + vat)}</td>
      </tr>
    </table>`;

  // ── Notification to IBSA ──────────────────────────────────────────────────
  await sendEmail({
    to: IBSA_NOTIFY_EMAIL,
    subject: `New order — ${groupTypeLabel[groupType] ?? groupType}: ${groupName}`,
    text: `New order from ${groupName} (${groupTypeLabel[groupType] ?? groupType})\nContact: ${contactName} <${contactEmail}>${contactMobile ? `\nMobile: ${contactMobile}` : ""}${requiredBy ? `\nRequired by: ${requiredBy}` : ""}${deliveryAddress ? `\nDelivery: ${deliveryAddress}` : ""}${notes ? `\nNotes: ${notes}` : ""}\n\nCS lines: ${csLines.length} | FA lines: ${faLines.length} | Total: ${fmtGbp(grandTotal)}`,
    html: `${baseHtml}
        <h1 style="color:#0f172a;font-size:20px;margin:0 0 20px;">New order received</h1>
        <div style="background:#f8fafc;border-radius:8px;padding:16px;margin-bottom:4px;border:1px solid #e2e8f0;">
          <p style="color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:.05em;margin:0 0 2px;">${groupTypeLabel[groupType] ?? groupType}</p>
          <p style="color:#0f172a;font-size:16px;font-weight:bold;margin:0 0 10px;">${groupName}</p>
          <p style="color:#64748b;font-size:13px;margin:0 0 3px;"><strong style="color:#1e293b;">Contact:</strong> ${contactName} · ${contactEmail}${contactMobile ? ` · ${contactMobile}` : ""}</p>
          ${requiredBy ? `<p style="color:#64748b;font-size:13px;margin:3px 0 0;"><strong style="color:#1e293b;">Required by:</strong> ${requiredBy}</p>` : ""}
          ${deliveryAddress ? `<p style="color:#64748b;font-size:13px;margin:3px 0 0;"><strong style="color:#1e293b;">Delivery:</strong> ${deliveryAddress.replace(/\n/g, ", ")}</p>` : ""}
          ${paymentMethod ? `<p style="color:#64748b;font-size:13px;margin:3px 0 0;"><strong style="color:#1e293b;">Payment:</strong> ${{ bacs: "BACS Transfer", card: "Credit / Debit Card", po: "Purchase Order" }[paymentMethod] ?? paymentMethod}</p>` : ""}
          ${notes ? `<p style="color:#64748b;font-size:13px;margin:3px 0 0;"><strong style="color:#1e293b;">Notes:</strong> ${notes}</p>` : ""}
        </div>
        ${sectionHtml("Cleaning Supplies", csLines)}
        ${sectionHtml("First Aid", faLines)}
        ${grandTotalHtml}
        <p style="color:#94a3b8;font-size:11px;margin:20px 0 0;">Order ID: ${order.id}</p>
        ${emailFooterHtml}
      </div>
    </div>`,
  });

  // ── Confirmation + account setup to submitter ──────────────────────────────
  await sendEmail({
    to: contactEmail,
    subject: `Order received — Xylo (UK) Ltd`,
    text: `Hi ${contactName},\n\nThank you — we've received your order for ${groupName}. We'll be in touch to confirm delivery details.\n\nOrder total: ${fmtGbp(grandTotal)}\n\nYour account is ready. Use the link below to view your orders and re-order at any time (link valid 7 days):\n${accountUrl}\n\nQuestions? Email ${IBSA_NOTIFY_EMAIL}.\n\nIBSA · Xylo (UK) Ltd`,
    html: `${baseHtml}
        <h1 style="color:#0f172a;font-size:20px;margin:0 0 4px;">Order received ✓</h1>
        <p style="color:#64748b;font-size:14px;margin:0 0 6px;">Hi ${contactName}, thank you — we've received your order for <strong style="color:#1e293b;">${groupName}</strong> and will be in touch to confirm delivery details.</p>
        ${requiredBy ? `<p style="color:#94a3b8;font-size:12px;margin:0 0 4px;"><strong style="color:#64748b;">Required by:</strong> ${requiredBy}</p>` : ""}
        ${deliveryAddress ? `<p style="color:#94a3b8;font-size:12px;margin:0 0 16px;"><strong style="color:#64748b;">Delivery:</strong> ${deliveryAddress.replace(/\n/g, ", ")}</p>` : `<p style="margin:0 0 16px;"></p>`}
        ${sectionHtml("Cleaning Supplies", csLines)}
        ${sectionHtml("First Aid", faLines)}
        ${grandTotalHtml}

        <div style="margin:24px 0 0;padding:20px;background:#fff7ed;border-radius:10px;border-left:3px solid #f97316;">
          <p style="color:#f97316;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:.08em;margin:0 0 8px;">Your Xylo account</p>
          <p style="color:#1e293b;font-size:13px;margin:0 0 12px;">We've saved your order to your Xylo account. From there you can:</p>
          <table style="margin:0 0 16px;border-collapse:collapse;">
            <tr><td style="padding:2px 8px 2px 0;color:#f97316;font-size:12px;">✓</td><td style="color:#64748b;font-size:13px;padding:2px 0;">View your order details and current status</td></tr>
            <tr><td style="padding:2px 8px 2px 0;color:#f97316;font-size:12px;">✓</td><td style="color:#64748b;font-size:13px;padding:2px 0;">Re-order previous items with a single click</td></tr>
            <tr><td style="padding:2px 8px 2px 0;color:#f97316;font-size:12px;">✓</td><td style="color:#64748b;font-size:13px;padding:2px 0;">See your full order history across all events</td></tr>
          </table>
          <a href="${accountUrl}" style="display:inline-block;background:#f97316;color:#fff;font-size:13px;font-weight:bold;padding:10px 20px;border-radius:8px;text-decoration:none;">Access your account →</a>
          <p style="color:#94a3b8;font-size:11px;margin:12px 0 0;">🔒 <strong style="color:#64748b;">No password needed, and nothing to guess.</strong> Your link is unique to you, expires in 7 days, and works only once — so your account stays private even if this email is ever forwarded. <a href="${BASE_URL}/account/login" style="color:#64748b;">Request a new link</a> any time.</p>
        </div>

        <p style="color:#64748b;font-size:13px;margin:20px 0 0;">Questions? Email <a href="mailto:${IBSA_NOTIFY_EMAIL}" style="color:#f97316;">${IBSA_NOTIFY_EMAIL}</a></p>
        ${emailFooterHtml}
      </div>
    </div>`,
  });

  redirect(`/order/submitted?name=${encodeURIComponent(groupName)}`);
}
