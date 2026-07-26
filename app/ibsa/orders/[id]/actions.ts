"use server";

import Stripe from "stripe"; // class only — no client instantiated here
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "../../../../src/lib/prisma";
import { sendEmail } from "../../../../src/lib/sendEmail";

const IBSA_NOTIFY_EMAIL = "ibsa@xylouk.co.uk";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://ibsa.xylouk.co.uk";

export async function sendStripeInvoice(orderId: string) {
  // Lazy import — keeps stripe.ts from running at module load time,
  // which would crash the page if STRIPE_SECRET_KEY isn't set.
  const { stripe } = await import("../../../../src/lib/stripe");
  const order = await prisma.ibsaGroupOrder.findUnique({
    where: { id: orderId },
    include: {
      lines: { include: { product: true } },
      groupAccount: true,
    },
  });

  if (!order) throw new Error("Order not found");
  if (order.stripeInvoiceId) throw new Error("Invoice already sent");
  if (order.lines.length === 0) throw new Error("Order has no line items");

  // ── Upsert Stripe customer ────────────────────────────────────────────────
  let stripeCustomerId = order.groupAccount?.stripeCustomerId ?? null;

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      name: order.groupName,
      email: order.contactEmail,
      metadata: { orderId: order.id, groupAccountId: order.groupAccountId ?? "" },
    });
    stripeCustomerId = customer.id;

    // Persist on GroupAccount if linked
    if (order.groupAccountId) {
      await prisma.groupAccount.update({
        where: { id: order.groupAccountId },
        data: { stripeCustomerId },
      });
    }
  }

  // ── Create invoice ────────────────────────────────────────────────────────
  const invoice = await stripe.invoices.create({
    customer: stripeCustomerId,
    collection_method: "send_invoice",
    days_until_due: 14,
    currency: "gbp",
    metadata: { orderId: order.id },
    custom_fields: [
      { name: "Order reference", value: order.id.slice(-8).toUpperCase() },
    ],
  });

  // ── Add line items ────────────────────────────────────────────────────────
  for (const line of order.lines) {
    // xyloCost is the customer-facing price; unitCost is the buy price fallback
    const unitPrice = line.product.unitCost;
    const description = [
      line.product.name,
      line.product.variant ? `(${line.product.variant})` : null,
    ]
      .filter(Boolean)
      .join(" ");

    await stripe.invoiceItems.create({
      customer: stripeCustomerId,
      invoice: invoice.id,
      description,
      unit_amount_decimal: Stripe.Decimal.from(Math.round(unitPrice * 100)), // per-unit in pence; Stripe multiplies by quantity
      quantity: line.qty,
      currency: "gbp",
    });
  }

  // ── Finalise and send ─────────────────────────────────────────────────────
  await stripe.invoices.finalizeInvoice(invoice.id);
  await stripe.invoices.sendInvoice(invoice.id);

  // ── Persist on order ──────────────────────────────────────────────────────
  await prisma.ibsaGroupOrder.update({
    where: { id: orderId },
    data: {
      stripeInvoiceId: invoice.id,
      invoicedAt: new Date(),
      status: "processing",
    },
  });

  revalidatePath(`/ibsa/orders/${orderId}`);
  revalidatePath("/ibsa/orders");
}

export async function updateOrderStatus(formData: FormData) {
  const orderId = (formData.get("orderId") as string).trim();
  const status  = (formData.get("status")  as string).trim();
  if (!orderId || !status) return;

  const order = await prisma.ibsaGroupOrder.update({
    where: { id: orderId },
    data: { status },
  });

  revalidatePath(`/ibsa/orders/${orderId}`);
  revalidatePath("/ibsa/orders");

  // ── Status update email to customer ────────────────────────────────────────
  const baseCard = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;padding:8px;">
      <div style="background:#ffffff;padding:32px;border-radius:12px;border:1px solid #e2e8f0;">
        <p style="color:#f97316;font-size:16px;font-weight:bold;margin:0 0 4px;">IBSA · Xylo (UK) Ltd</p>`;

  if (status === "processing") {
    await sendEmail({
      to: order.contactEmail,
      subject: `Your order is being prepared — Xylo (UK) Ltd`,
      text: `Hi ${order.contactName},\n\nGreat news — we've received your order for ${order.groupName} and it's now being prepared for dispatch. We'll be in touch with tracking details once it's on its way.\n\nQuestions? Email ${IBSA_NOTIFY_EMAIL}.\n\nIBSA · Xylo (UK) Ltd`,
      html: `${baseCard}
        <h1 style="color:#0f172a;font-size:20px;margin:0 0 4px;">Your order is being prepared</h1>
        <p style="color:#64748b;font-size:14px;margin:0 0 16px;">Hi ${order.contactName}, great news — your order for <strong style="color:#1e293b;">${order.groupName}</strong> is now being prepared for dispatch.</p>
        <p style="color:#64748b;font-size:14px;margin:0 0 20px;">We'll be in touch with tracking details once it's on its way.</p>
        <a href="${BASE_URL}/account" style="display:inline-block;background:#f97316;color:#fff;font-size:13px;font-weight:bold;padding:10px 20px;border-radius:8px;text-decoration:none;">View your order →</a>
        <p style="color:#64748b;font-size:13px;margin:20px 0 0;">Questions? Email <a href="mailto:${IBSA_NOTIFY_EMAIL}" style="color:#f97316;">${IBSA_NOTIFY_EMAIL}</a></p>
      </div>
    </div>`,
    });
  }

  if (status === "complete") {
    await sendEmail({
      to: order.contactEmail,
      subject: `Your order is complete — Xylo (UK) Ltd`,
      text: `Hi ${order.contactName},\n\nYour order for ${order.groupName} is now marked as complete. Thank you for ordering through Xylo — we hope everything arrived in perfect condition.\n\nQuestions? Email ${IBSA_NOTIFY_EMAIL}.\n\nIBSA · Xylo (UK) Ltd`,
      html: `${baseCard}
        <h1 style="color:#0f172a;font-size:20px;margin:0 0 4px;">Order complete ✓</h1>
        <p style="color:#64748b;font-size:14px;margin:0 0 16px;">Hi ${order.contactName}, your order for <strong style="color:#1e293b;">${order.groupName}</strong> is now complete. Thank you for ordering through Xylo — we hope everything arrived in perfect condition.</p>
        <p style="color:#64748b;font-size:14px;margin:0 0 20px;">If you need to order again in future, your account keeps everything on file for a quick re-order.</p>
        <a href="${BASE_URL}/account" style="display:inline-block;background:#f97316;color:#fff;font-size:13px;font-weight:bold;padding:10px 20px;border-radius:8px;text-decoration:none;">View your account →</a>
        <p style="color:#64748b;font-size:13px;margin:20px 0 0;">Questions? Email <a href="mailto:${IBSA_NOTIFY_EMAIL}" style="color:#f97316;">${IBSA_NOTIFY_EMAIL}</a></p>
      </div>
    </div>`,
    });
  }
}

export async function saveTrackingRef(formData: FormData) {
  const orderId    = (formData.get("orderId")    as string).trim();
  const trackingRef = (formData.get("trackingRef") as string).trim();
  if (!orderId) return;

  const order = await prisma.ibsaGroupOrder.update({
    where: { id: orderId },
    data: { trackingRef: trackingRef || null, status: "processing" },
  });

  // Email customer with tracking link
  if (trackingRef) {
    const baseCard = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;padding:8px;">
        <div style="background:#ffffff;padding:32px;border-radius:12px;border:1px solid #e2e8f0;">
          <p style="color:#f97316;font-size:16px;font-weight:bold;margin:0 0 4px;">IBSA · Xylo (UK) Ltd</p>`;

    await sendEmail({
      to: order.contactEmail,
      subject: `Your order has been dispatched — Xylo (UK) Ltd`,
      text: `Hi ${order.contactName},\n\nYour order for ${order.groupName} has been dispatched!\n\nTracking reference: ${trackingRef}\n\nQuestions? Email ${IBSA_NOTIFY_EMAIL}.\n\nIBSA · Xylo (UK) Ltd`,
      html: `${baseCard}
          <h1 style="color:#0f172a;font-size:20px;margin:0 0 4px;">Your order is on its way 🚚</h1>
          <p style="color:#64748b;font-size:14px;margin:0 0 16px;">Hi ${order.contactName}, your order for <strong style="color:#1e293b;">${order.groupName}</strong> has been dispatched.</p>
          <div style="background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;padding:14px 16px;margin-bottom:20px;">
            <p style="color:#94a3b8;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:.06em;margin:0 0 4px;">Tracking reference</p>
            <p style="color:#0f172a;font-size:16px;font-weight:bold;margin:0;">${trackingRef}</p>
          </div>
          <a href="${BASE_URL}/account" style="display:inline-block;background:#f97316;color:#fff;font-size:13px;font-weight:bold;padding:10px 20px;border-radius:8px;text-decoration:none;">View your order →</a>
          <p style="color:#64748b;font-size:13px;margin:20px 0 0;">Questions? Email <a href="mailto:${IBSA_NOTIFY_EMAIL}" style="color:#f97316;">${IBSA_NOTIFY_EMAIL}</a></p>
        </div>
      </div>`,
    });
  }

  revalidatePath(`/ibsa/orders/${orderId}`);
}

export async function saveAdminNotes(formData: FormData) {
  const orderId    = (formData.get("orderId")    as string).trim();
  const adminNotes = (formData.get("adminNotes") as string).trim();
  if (!orderId) return;

  await prisma.ibsaGroupOrder.update({
    where: { id: orderId },
    data: { adminNotes: adminNotes || null },
  });

  revalidatePath(`/ibsa/orders/${orderId}`);
}

export async function amendOrder(formData: FormData) {
  const orderId = (formData.get("orderId") as string).trim();
  if (!orderId) return;

  // Fetch current order for comparison + email context
  const before = await prisma.ibsaGroupOrder.findUnique({
    where: { id: orderId },
    include: { lines: { include: { product: true } } },
  });
  if (!before) return;

  const changes: { type: "changed" | "removed" | "added"; name: string; variant?: string | null; oldQty?: number; newQty?: number }[] = [];

  // ── 1. Update / remove existing lines ────────────────────────────────────
  for (const line of before.lines) {
    const raw = formData.get(`line_${line.id}`);
    if (raw === null) continue;
    const newQty = Math.max(0, parseInt(raw as string, 10) || 0);

    if (newQty === 0) {
      await prisma.ibsaGroupOrderLine.delete({ where: { id: line.id } });
      changes.push({ type: "removed", name: line.product.name, variant: line.product.variant, oldQty: line.qty });
    } else if (newQty !== line.qty) {
      await prisma.ibsaGroupOrderLine.update({ where: { id: line.id }, data: { qty: newQty } });
      changes.push({ type: "changed", name: line.product.name, variant: line.product.variant, oldQty: line.qty, newQty });
    }
  }

  // ── 2. Add new lines ───────────────────────────────────────────────────────
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("new_")) continue;
    const qty = Math.max(0, parseInt(value as string, 10) || 0);
    if (qty === 0) continue;

    // key format: new_<productId>_<dept>
    const parts = key.slice(4).split("_");
    const dept      = parts.pop()!;           // last segment
    const productId = parts.join("_");         // everything before

    // If a line already exists for this product + dept, bump it
    const existing = before.lines.find((l) => l.productId === productId && l.dept === dept);
    if (existing) {
      const merged = existing.qty + qty;
      await prisma.ibsaGroupOrderLine.update({ where: { id: existing.id }, data: { qty: merged } });
      // If we already logged a "changed" for this line, update it; otherwise add
      const prev = changes.find((c) => c.type === "changed" && c.name === existing.product.name && c.variant === existing.product.variant);
      if (prev) { prev.newQty = merged; } else {
        changes.push({ type: "changed", name: existing.product.name, variant: existing.product.variant, oldQty: existing.qty, newQty: merged });
      }
    } else {
      const product = await prisma.ibsaProduct.findUnique({ where: { id: productId } });
      if (!product) continue;
      await prisma.ibsaGroupOrderLine.create({ data: { orderId, productId, dept, qty } });
      changes.push({ type: "added", name: product.name, variant: product.variant, newQty: qty });
    }
  }

  if (changes.length === 0) {
    revalidatePath(`/ibsa/orders/${orderId}`);
    return;
  }

  // ── 3. Reload for new totals ───────────────────────────────────────────────
  const after = await prisma.ibsaGroupOrder.findUnique({
    where: { id: orderId },
    include: { lines: { include: { product: true } } },
  });
  if (!after) return;

  const fmtGbp    = (n: number) => "£" + n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const newTotal  = after.lines.reduce((s, l) => s + l.qty * l.product.unitCost, 0);

  // ── 4. Build change summary HTML ──────────────────────────────────────────
  const changeRows = changes.map((c) => {
    const productLabel = `${c.name}${c.variant ? ` <span style="color:#94a3b8;font-size:11px;">(${c.variant})</span>` : ""}`;
    if (c.type === "removed") {
      return `<tr>
        <td style="padding:6px 8px;color:#ef4444;font-size:13px;">✕</td>
        <td style="padding:6px 8px;color:#ef4444;font-size:13px;text-decoration:line-through;">${productLabel}</td>
        <td style="padding:6px 8px;color:#ef4444;font-size:13px;text-align:right;">Removed</td>
      </tr>`;
    }
    if (c.type === "added") {
      return `<tr>
        <td style="padding:6px 8px;color:#22c55e;font-size:13px;">+</td>
        <td style="padding:6px 8px;color:#1e293b;font-size:13px;">${productLabel}</td>
        <td style="padding:6px 8px;color:#22c55e;font-size:13px;text-align:right;">Added × ${c.newQty}</td>
      </tr>`;
    }
    const dir = (c.newQty ?? 0) > (c.oldQty ?? 0) ? "↑" : "↓";
    const col = dir === "↑" ? "#22c55e" : "#f97316";
    return `<tr>
      <td style="padding:6px 8px;color:${col};font-size:13px;">${dir}</td>
      <td style="padding:6px 8px;color:#1e293b;font-size:13px;">${productLabel}</td>
      <td style="padding:6px 8px;color:${col};font-size:13px;text-align:right;">${c.oldQty} → ${c.newQty}</td>
    </tr>`;
  }).join("");

  const changeSummaryHtml = `
    <p style="color:#64748b;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:.06em;margin:20px 0 6px;">Changes</p>
    <table style="width:100%;border-collapse:collapse;background:#ffffff;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:16px;">
      <tbody>${changeRows}</tbody>
      <tfoot>
        <tr>
          <td colspan="2" style="padding:8px;color:#94a3b8;font-size:12px;text-align:right;border-top:1px solid #e2e8f0;">New order total</td>
          <td style="padding:8px;color:#f97316;font-size:14px;font-weight:800;text-align:right;border-top:1px solid #e2e8f0;">${fmtGbp(newTotal)}</td>
        </tr>
      </tfoot>
    </table>`;

  const baseHtml = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;padding:8px;">
      <div style="background:#ffffff;padding:32px;border-radius:12px;border:1px solid #e2e8f0;">
        <p style="color:#f97316;font-size:16px;font-weight:bold;margin:0 0 4px;">IBSA · Xylo (UK) Ltd</p>`;

  const changeText = changes.map((c) => {
    if (c.type === "removed") return `  Removed: ${c.name}${c.variant ? ` (${c.variant})` : ""}`;
    if (c.type === "added")   return `  Added: ${c.name}${c.variant ? ` (${c.variant})` : ""} × ${c.newQty}`;
    return `  Changed: ${c.name}${c.variant ? ` (${c.variant})` : ""} — ${c.oldQty} → ${c.newQty}`;
  }).join("\n");

  // ── 5. Notify IBSA ────────────────────────────────────────────────────────
  await sendEmail({
    to: IBSA_NOTIFY_EMAIL,
    subject: `Order amended — ${before.groupName}`,
    text: `Order for ${before.groupName} has been amended.\n\nChanges:\n${changeText}\n\nNew total: ${fmtGbp(newTotal)}\nOrder ID: ${orderId}`,
    html: `${baseHtml}
        <h1 style="color:#0f172a;font-size:20px;margin:0 0 4px;">Order amended</h1>
        <p style="color:#64748b;font-size:14px;margin:0 0 20px;">The order for <strong style="color:#1e293b;">${before.groupName}</strong> (${before.contactName}) has been amended.</p>
        ${changeSummaryHtml}
        <p style="color:#94a3b8;font-size:11px;margin:20px 0 0;">Order ID: ${orderId}</p>
      </div>
    </div>`,
  });

  // ── 6. Notify customer ────────────────────────────────────────────────────
  await sendEmail({
    to: before.contactEmail,
    subject: `Your order has been updated — Xylo (UK) Ltd`,
    text: `Hi ${before.contactName},\n\nYour order for ${before.groupName} has been updated by IBSA. Here's a summary of the changes:\n\n${changeText}\n\nNew total: ${fmtGbp(newTotal)}\n\nIf you have any questions please email ${IBSA_NOTIFY_EMAIL}.\n\nIBSA · Xylo (UK) Ltd`,
    html: `${baseHtml}
        <h1 style="color:#0f172a;font-size:20px;margin:0 0 4px;">Your order has been updated</h1>
        <p style="color:#64748b;font-size:14px;margin:0 0 20px;">Hi ${before.contactName}, your order for <strong style="color:#1e293b;">${before.groupName}</strong> has been updated. Here's what changed:</p>
        ${changeSummaryHtml}
        <p style="color:#64748b;font-size:13px;margin:0 0 20px;">If you have any questions please email <a href="mailto:${IBSA_NOTIFY_EMAIL}" style="color:#f97316;">${IBSA_NOTIFY_EMAIL}</a>.</p>
        <a href="${BASE_URL}/account" style="display:inline-block;background:#f97316;color:#fff;font-size:13px;font-weight:bold;padding:10px 20px;border-radius:8px;text-decoration:none;">View your order →</a>
      </div>
    </div>`,
  });

  revalidatePath(`/ibsa/orders/${orderId}`);
  revalidatePath("/ibsa/orders");
}

export async function deleteOrder(formData: FormData) {
  const orderId   = (formData.get("orderId")   as string).trim();
  const groupType = (formData.get("groupType") as string).trim();
  if (!orderId) return;

  await prisma.ibsaGroupOrder.delete({ where: { id: orderId } });

  revalidatePath("/ibsa");
  revalidatePath("/ibsa/orders");

  const typeParam = groupType === "circuit" ? "circuit" : groupType === "congregation" ? "congregation" : "regional";
  redirect(`/ibsa?type=${typeParam}`);
}
