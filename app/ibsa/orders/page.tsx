import { prisma } from "../../../src/lib/prisma";
import IbsaAppShell from "../../../src/components/ibsa-app-shell";
import OrdersClient, { type PurchaseOrder } from "./OrdersClient";
import GroupOrdersSection, { type GroupOrder } from "./GroupOrdersSection";

export default async function OrdersPage() {
  const pos = await prisma.ibsaPurchaseOrder.findMany({
    include: { lines: { orderBy: { createdAt: "asc" } } },
    orderBy: { orderedAt: "desc" },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const groupOrders: any[] = await (prisma as any).ibsaGroupOrder.findMany({
    include: {
      lines: {
        include: { product: { select: { name: true, variant: true, code: true, unitCost: true } } },
        orderBy: [{ dept: "asc" }],
      },
    },
    orderBy: { submittedAt: "desc" },
  });

  const poData: PurchaseOrder[] = pos.map((o) => ({
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
      productBreakdown: JSON.parse(l.productBreakdown as string) as Array<{
        ibsaProductId: string;
        name: string;
        units: number;
      }>,
    })),
  }));

  const groupData: GroupOrder[] = groupOrders.map((o) => ({
    id: o.id,
    groupType: o.groupType,
    groupName: o.groupName,
    contactName: o.contactName,
    contactEmail: o.contactEmail,
    contactMobile: o.contactMobile ?? null,
    status: o.status,
    submittedAt: o.submittedAt.toISOString(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    lines: o.lines.map((l: any) => ({
      id: l.id,
      dept: l.dept,
      qty: l.qty,
      productName: l.product.name,
      productVariant: l.product.variant ?? null,
      productCode: l.product.code,
      unitCost: l.product.unitCost,
    })),
  }));

  return (
    <IbsaAppShell active="ibsa-orders">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Orders</h1>
        <p className="mt-1 text-sm text-slate-400">
          Group supply orders and supplier purchase orders.
        </p>
      </div>

      {/* Group orders — congregation/circuit/regional */}
      <GroupOrdersSection orders={groupData} />

      {/* Purchase orders — supplier POs */}
      <div className="mt-10">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Supplier Purchase Orders
        </p>
        <OrdersClient orders={poData} hideHeader />
      </div>
    </IbsaAppShell>
  );
}
