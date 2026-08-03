import { prisma } from "../../../src/lib/prisma";
import IbsaAppShell from "../../../src/components/ibsa-app-shell";
import PosClient, { type Po } from "./PosClient";

export const dynamic = "force-dynamic";

export default async function PosPage() {
  const pos = await prisma.ibsaPurchaseOrder.findMany({
    orderBy: { orderedAt: "desc" },
    include: {
      lines: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const serialise = (po: (typeof pos)[0]): Po => ({
    id: po.id,
    poNumber: po.poNumber,
    supplier: po.supplier,
    status: po.status,
    orderedAt: po.orderedAt.toISOString(),
    receivedAt: po.receivedAt?.toISOString() ?? null,
    totalExVat: po.totalExVat,
    notes: po.notes ?? null,
    lines: po.lines.map((l) => ({
      id: l.id,
      rsCode: l.rsCode ?? null,
      description: l.description,
      variant: l.variant ?? null,
      cartonSize: l.cartonSize ?? null,
      cartonsOrdered: l.cartonsOrdered,
      cartonsReceived: l.cartonsReceived,
      pricePerCarton: l.pricePerCarton ?? null,
      totalCost: l.totalCost ?? null,
    })),
  });

  const open   = pos.filter((p) => p.status === "ordered" || p.status === "partial").map(serialise);
  const closed = pos.filter((p) => p.status === "received" || p.status === "cancelled").map(serialise);

  return (
    <IbsaAppShell active="ibsa-pos">
      <PosClient open={open} closed={closed} />
    </IbsaAppShell>
  );
}
