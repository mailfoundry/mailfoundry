"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "../../../../src/lib/prisma";

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
      description: `${description} ×${line.qty}`,
      amount: Math.round(unitPrice * line.qty * 100), // total in pence
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

  await prisma.ibsaGroupOrder.update({
    where: { id: orderId },
    data: { status },
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
