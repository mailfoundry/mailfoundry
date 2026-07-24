"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../../../../src/lib/prisma";

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
