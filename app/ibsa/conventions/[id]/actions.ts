"use server";

import { prisma } from "../../../../src/lib/prisma";
import { revalidatePath } from "next/cache";

export async function updateOrderQty(formData: FormData) {
  const conventionId = formData.get("conventionId")?.toString() ?? "";
  const productId = formData.get("productId")?.toString() ?? "";
  const qty = parseInt(formData.get("qty")?.toString() ?? "0") || 0;

  if (!conventionId || !productId) return;

  if (qty <= 0) {
    await prisma.ibsaOrderItem.deleteMany({ where: { conventionId, productId } });
  } else {
    await prisma.ibsaOrderItem.upsert({
      where: { conventionId_productId: { conventionId, productId } },
      create: { conventionId, productId, qty },
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
}

export async function updateShippingCost(formData: FormData) {
  const conventionId = formData.get("conventionId")?.toString() ?? "";
  const cost = parseFloat(formData.get("shippingCost")?.toString() ?? "0") || 0;
  if (!conventionId) return;
  await prisma.ibsaConvention.update({
    where: { id: conventionId },
    data: { shippingCost: cost },
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
