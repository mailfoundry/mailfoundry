"use server";

import { prisma } from "../../../../src/lib/prisma";
import { revalidatePath } from "next/cache";
import { sendEmail } from "../../../../src/lib/sendEmail";

/** Send the convention order form magic link to the contact email on file */
export async function sendOrderFormLink(formData: FormData) {
  const conventionId = (formData.get("conventionId") as string).trim();
  if (!conventionId) return { error: "Missing convention ID" };

  const convention = await prisma.ibsaConvention.findUnique({
    where: { id: conventionId },
    select: { name: true, conventionDate: true, contactEmail: true },
  });

  if (!convention?.contactEmail) return { error: "No contact email on file" };

  const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
  const token      = crypto.randomUUID();
  const expiresAt  = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.conventionOrderToken.create({
    data: { token, email: convention.contactEmail, conventionId, expiresAt },
  });

  const verifyUrl = `${appBaseUrl}/convention/verify?token=${token}`;
  const date = convention.conventionDate.toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });

  await sendEmail({
    to: convention.contactEmail,
    subject: `Your order form — ${convention.name}`,
    text: `Hi,\n\nClick the link below to fill in your product requirements for ${convention.name} (${date}).\n\n${verifyUrl}\n\nThis link expires in 1 hour.\n\nIf you didn't expect this email, please ignore it.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;">
        <div style="background:#0f172a;padding:32px;border-radius:12px;">
          <p style="color:#f97316;font-size:18px;font-weight:bold;margin:0 0 8px;">IBSA · Xylo Supplies</p>
          <h1 style="color:#fff;font-size:22px;margin:0 0 8px;">Your order form</h1>
          <div style="background:#1e293b;border-radius:8px;padding:14px;margin-bottom:20px;">
            <p style="color:#94a3b8;font-size:12px;margin:0 0 2px;">${date}</p>
            <p style="color:#f1f5f9;font-size:16px;font-weight:bold;margin:0;">${convention.name}</p>
          </div>
          <p style="color:#94a3b8;margin:0 0 20px;">Click the button below to select the products you need for this convention. The link expires in 1 hour.</p>
          <a href="${verifyUrl}" style="display:inline-block;background:#f97316;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:bold;font-size:15px;">
            Open order form →
          </a>
          <p style="color:#475569;font-size:12px;margin:20px 0 0;">If you didn't expect this email, you can safely ignore it.</p>
        </div>
      </div>
    `,
  });

  return { ok: true, email: convention.contactEmail };
}

export async function updateOrderQty(formData: FormData) {
  const conventionId = formData.get("conventionId")?.toString() ?? "";
  const productId = formData.get("productId")?.toString() ?? "";
  const dept = formData.get("dept")?.toString() ?? "CS";
  const qty = parseInt(formData.get("qty")?.toString() ?? "0") || 0;

  if (!conventionId || !productId) return;

  if (qty <= 0) {
    await prisma.ibsaOrderItem.deleteMany({ where: { conventionId, productId, dept } });
  } else {
    await prisma.ibsaOrderItem.upsert({
      where: { conventionId_productId_dept: { conventionId, productId, dept } },
      create: { conventionId, productId, dept, qty },
      update: { qty },
    });
  }
  revalidatePath(`/ibsa/conventions/${conventionId}`);
}

export async function updateConventionStatus(formData: FormData) {
  const conventionId = formData.get("conventionId")?.toString() ?? "";
  const status = formData.get("status")?.toString() ?? "";
  if (!conventionId || !status) return;
  await prisma.ibsaConvention.update({ where: { id: conventionId }, data: { status } });
  revalidatePath(`/ibsa/conventions/${conventionId}`);
  revalidatePath("/ibsa");
  revalidatePath("/ibsa/purchasing");
}

/**
 * Marks a convention shipment (CS or FA) as complete AND decrements inStock
 * for every product in that shipment by its ordered qty.
 */
export async function markCompleteAndDeductStock(formData: FormData) {
  const conventionId = formData.get("conventionId")?.toString() ?? "";
  const dept = formData.get("dept")?.toString() ?? "CS"; // "CS" | "FA"
  if (!conventionId) return;

  const items = await prisma.ibsaOrderItem.findMany({
    where: { conventionId, dept },
    select: { productId: true, qty: true },
  });

  await prisma.$transaction([
    prisma.ibsaConvention.update({
      where: { id: conventionId },
      data: dept === "FA" ? { faStatus: "complete" } : { status: "complete" },
    }),
    ...items
      .filter((i) => i.qty > 0)
      .map((i) =>
        prisma.ibsaProduct.update({
          where: { id: i.productId },
          data: { inStock: { decrement: i.qty } },
        })
      ),
  ]);

  revalidatePath(`/ibsa/conventions/${conventionId}`);
  revalidatePath("/ibsa");
  revalidatePath("/ibsa/purchasing");
  revalidatePath("/ibsa/products");
}

export async function updateShippingCost(formData: FormData) {
  const conventionId = formData.get("conventionId")?.toString() ?? "";
  const cost = parseFloat(formData.get("shippingCost")?.toString() ?? "0") || 0;
  const field = formData.get("field")?.toString() ?? "cs";
  if (!conventionId) return;
  await prisma.ibsaConvention.update({
    where: { id: conventionId },
    data: field === "fa" ? { faShippingCost: cost } : { shippingCost: cost },
  });
  revalidatePath(`/ibsa/conventions/${conventionId}`);
}

export async function updateConventionDate(formData: FormData) {
  const conventionId = formData.get("conventionId")?.toString() ?? "";
  const date = formData.get("date")?.toString() ?? "";
  if (!conventionId || !date) return;
  await prisma.ibsaConvention.update({
    where: { id: conventionId },
    data: { conventionDate: new Date(date) },
  });
  revalidatePath(`/ibsa/conventions/${conventionId}`);
  revalidatePath("/ibsa");
}

export async function updateDeliveryDate(formData: FormData) {
  const conventionId = formData.get("conventionId")?.toString() ?? "";
  const date = formData.get("date")?.toString() ?? "";
  if (!conventionId) return;
  await prisma.ibsaConvention.update({
    where: { id: conventionId },
    data: { deliveryDate: date ? new Date(date) : null },
  });
  revalidatePath(`/ibsa/conventions/${conventionId}`);
  revalidatePath("/ibsa");
}

export async function updateLogistics(formData: FormData) {
  const conventionId = formData.get("conventionId")?.toString() ?? "";
  if (!conventionId) return;

  const collectionDate = formData.get("collectionDate")?.toString() ?? "";
  const paymentDueDate = formData.get("paymentDueDate")?.toString() ?? "";
  const deliveryAddress = formData.get("deliveryAddress")?.toString() ?? "";
  const contactName = formData.get("contactName")?.toString() ?? "";
  const contactEmail = formData.get("contactEmail")?.toString() ?? "";
  const contactMobile = formData.get("contactMobile")?.toString() ?? "";

  await prisma.ibsaConvention.update({
    where: { id: conventionId },
    data: {
      collectionDate: collectionDate ? new Date(collectionDate) : null,
      paymentDueDate: paymentDueDate ? new Date(paymentDueDate) : null,
      deliveryAddress: deliveryAddress || null,
      contactName: contactName || null,
      contactEmail: contactEmail || null,
      contactMobile: contactMobile || null,
    },
  });
  revalidatePath(`/ibsa/conventions/${conventionId}`);
  revalidatePath("/ibsa");
}

export async function markPaid(formData: FormData) {
  const conventionId = formData.get("conventionId")?.toString() ?? "";
  if (!conventionId) return;
  await prisma.ibsaConvention.update({
    where: { id: conventionId },
    data: { paidAt: new Date() },
  });
  revalidatePath(`/ibsa/conventions/${conventionId}`);
  revalidatePath("/ibsa");
}

export async function markUnpaid(formData: FormData) {
  const conventionId = formData.get("conventionId")?.toString() ?? "";
  if (!conventionId) return;
  await prisma.ibsaConvention.update({
    where: { id: conventionId },
    data: { paidAt: null },
  });
  revalidatePath(`/ibsa/conventions/${conventionId}`);
  revalidatePath("/ibsa");
}

export async function updateFaStatus(formData: FormData) {
  const conventionId = formData.get("conventionId")?.toString() ?? "";
  const status = formData.get("status")?.toString() ?? "";
  if (!conventionId || !status) return;
  await prisma.ibsaConvention.update({ where: { id: conventionId }, data: { faStatus: status } });
  revalidatePath(`/ibsa/conventions/${conventionId}`);
  revalidatePath("/ibsa");
  revalidatePath("/ibsa/purchasing");
}

export async function markFaPaid(formData: FormData) {
  const conventionId = formData.get("conventionId")?.toString() ?? "";
  if (!conventionId) return;
  await prisma.ibsaConvention.update({
    where: { id: conventionId },
    data: { faPaidAt: new Date() },
  });
  revalidatePath(`/ibsa/conventions/${conventionId}`);
  revalidatePath("/ibsa");
}

export async function markFaUnpaid(formData: FormData) {
  const conventionId = formData.get("conventionId")?.toString() ?? "";
  if (!conventionId) return;
  await prisma.ibsaConvention.update({
    where: { id: conventionId },
    data: { faPaidAt: null },
  });
  revalidatePath(`/ibsa/conventions/${conventionId}`);
  revalidatePath("/ibsa");
}

export async function updateNotes(formData: FormData) {
  const conventionId = formData.get("conventionId")?.toString() ?? "";
  const notes = formData.get("notes")?.toString() ?? "";
  if (!conventionId) return;
  await prisma.ibsaConvention.update({
    where: { id: conventionId },
    data: { notes: notes.trim() || null },
  });
  revalidatePath(`/ibsa/conventions/${conventionId}`);
}

export async function importConventionOrder(formData: FormData) {
  const conventionId = formData.get("conventionId")?.toString() ?? "";
  const dept = formData.get("dept")?.toString() || "CS";
  const lines: { productId: string; qty: number }[] = JSON.parse(
    formData.get("lines")?.toString() ?? "[]"
  );
  if (!conventionId || lines.length === 0) return;

  await prisma.$transaction(
    lines.map((l) =>
      prisma.ibsaOrderItem.upsert({
        where: { conventionId_productId_dept: { conventionId, productId: l.productId, dept } },
        create: { conventionId, productId: l.productId, dept, qty: l.qty },
        update: { qty: l.qty },
      })
    )
  );

  revalidatePath(`/ibsa/conventions/${conventionId}`);
}

export async function updateFaLogistics(formData: FormData) {
  const conventionId = formData.get("conventionId")?.toString() ?? "";
  if (!conventionId) return;
  const faCollectionDate  = formData.get("faCollectionDate")?.toString() ?? "";
  const faDeliveryDate    = formData.get("faDeliveryDate")?.toString() ?? "";
  const faPaymentDueDate  = formData.get("faPaymentDueDate")?.toString() ?? "";
  const faDeliveryAddress = formData.get("faDeliveryAddress")?.toString() ?? "";
  const faShippingCost    = parseFloat(formData.get("faShippingCost")?.toString() ?? "0") || 0;
  await prisma.ibsaConvention.update({
    where: { id: conventionId },
    data: {
      faCollectionDate:  faCollectionDate  ? new Date(faCollectionDate)  : null,
      faDeliveryDate:    faDeliveryDate    ? new Date(faDeliveryDate)    : null,
      faPaymentDueDate:  faPaymentDueDate  ? new Date(faPaymentDueDate)  : null,
      faDeliveryAddress: faDeliveryAddress || null,
      faShippingCost,
    },
  });
  revalidatePath(`/ibsa/conventions/${conventionId}`);
  revalidatePath("/ibsa");
}
