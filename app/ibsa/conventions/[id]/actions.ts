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
