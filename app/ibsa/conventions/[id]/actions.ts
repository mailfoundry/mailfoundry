"use server";

import { prisma } from "../../../../src/lib/prisma";
import { revalidatePath } from "next/cache";

export async function updateOrderQty(
  conventionId: string,
  productId: string,
  qty: number
) {
  if (qty <= 0) {
    // delete the item if qty is 0
    await prisma.ibsaOrderItem.deleteMany({
      where: { conventionId, productId },
    });
  } else {
    await prisma.ibsaOrderItem.upsert({
      where: { conventionId_productId: { conventionId, productId } },
      create: { conventionId, productId, qty },
      update: { qty },
    });
  }
  revalidatePath(`/ibsa/conventions/${conventionId}`);
}

export async function updateConventionStatus(
  conventionId: string,
  status: string
) {
  await prisma.ibsaConvention.update({
    where: { id: conventionId },
    data: { status },
  });
  revalidatePath(`/ibsa/conventions/${conventionId}`);
  revalidatePath("/ibsa");
}

export async function updateDeliveryDate(conventionId: string, date: string) {
  await prisma.ibsaConvention.update({
    where: { id: conventionId },
    data: { deliveryDate: date ? new Date(date) : null },
  });
  revalidatePath(`/ibsa/conventions/${conventionId}`);
  revalidatePath("/ibsa");
}
