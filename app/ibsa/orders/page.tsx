import { prisma } from "../../../src/lib/prisma";
import IbsaAppShell from "../../../src/components/ibsa-app-shell";
import OrdersClient, { type PurchaseOrder } from "./OrdersClient";

export default async function OrdersPage() {
  const orders = await prisma.ibsaPurchaseOrder.findMany({
    include: {
      lines: {
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { orderedAt: "desc" },
  });

  const data: PurchaseOrder[] = orders.map((o) => ({
    id: o.id,
    poNumber: o.poNumber,
    supplier: o.supplier,
    status: o.status,
    orderedAt: o.orderedAt.toISOString(),
    receivedAt: o.receivedAt?.toISOString() ?? null,
    totalExVat: o.totalExVat,
    notes: o.notes ?? null,
    lines: o.lines.map((l) => ({
      id: l.id,
      rsCode: l.rsCode,
      description: l.description,
      variant: l.variant,
      cartonSize: l.cartonSize,
      cartonsOrdered: l.cartonsOrdered,
      cartonsReceived: l.cartonsReceived,
      pricePerCarton: l.pricePerCarton,
      totalCost: l.totalCost,
    })),
  }));

  return (
    <IbsaAppShell active="ibsa-orders">
      <OrdersClient orders={data} />
    </IbsaAppShell>
  );
}
