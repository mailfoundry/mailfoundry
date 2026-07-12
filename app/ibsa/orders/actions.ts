"use server";

import { prisma } from "../../../src/lib/prisma";
import { revalidatePath } from "next/cache";

/**
 * Records cartons received for a single PO line.
 * Updates the line's cartonsReceived and recalculates the parent order's status.
 * Stock/GIT is NOT auto-adjusted here — update via the Products page after delivery.
 */
export async function bookInLine(formData: FormData) {
  const lineId = formData.get("lineId") as string;
  const cartonsReceived = parseInt(formData.get("cartonsReceived") as string, 10);

  const line = await prisma.ibsaPurchaseOrderLine.findUnique({
    where: { id: lineId },
    select: { id: true, purchaseOrderId: true, cartonsOrdered: true, cartonsReceived: true },
  });
  if (!line) throw new Error("Line not found");

  await prisma.ibsaPurchaseOrderLine.update({
    where: { id: lineId },
    data: { cartonsReceived },
  });

  // Re-fetch all lines for this order to determine status
  const allLines = await prisma.ibsaPurchaseOrderLine.findMany({
    where: { purchaseOrderId: line.purchaseOrderId },
    select: { id: true, cartonsOrdered: true, cartonsReceived: true },
  });

  // Apply the update we just made in-memory (in case the DB hasn't flushed yet)
  const linesWithUpdate = allLines.map((l) =>
    l.id === lineId ? { ...l, cartonsReceived } : l
  );

  const anyReceived = linesWithUpdate.some((l) => l.cartonsReceived > 0);
  const allFullyReceived = linesWithUpdate.every(
    (l) => l.cartonsReceived >= l.cartonsOrdered
  );

  const newStatus = allFullyReceived
    ? "received"
    : anyReceived
    ? "partial"
    : "ordered";

  await prisma.ibsaPurchaseOrder.update({
    where: { id: line.purchaseOrderId },
    data: {
      status: newStatus,
      receivedAt: allFullyReceived ? new Date() : null,
    },
  });

  revalidatePath("/ibsa/orders");
}
