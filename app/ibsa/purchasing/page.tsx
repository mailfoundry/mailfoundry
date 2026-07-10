import { prisma } from "../../../src/lib/prisma";
import IbsaAppShell from "../../../src/components/ibsa-app-shell";
import PurchasingClient, { type Convention, type OrderItemFlat } from "./purchasing-client";

export default async function PurchasingPage() {
  const [conventions, orderItems] = await Promise.all([
    prisma.ibsaConvention.findMany({
      where: { archivedAt: null },
      orderBy: { conventionDate: "asc" },
      select: { id: true, name: true, conventionDate: true },
    }),
    prisma.ibsaOrderItem.findMany({
      where: { convention: { archivedAt: null } },
      select: {
        conventionId: true,
        dept: true,
        qty: true,
        product: {
          select: {
            id: true,
            name: true,
            variant: true,
            category: true,
            unitCost: true,
            inStock: true,
            git: true,
          },
        },
      },
    }),
  ]);

  // Serialise dates to strings for the client component
  const conventionData: Convention[] = conventions.map(c => ({
    id: c.id,
    name: c.name,
    conventionDate: c.conventionDate.toISOString(),
  }));

  const orderItemData: OrderItemFlat[] = orderItems.map(i => ({
    conventionId: i.conventionId,
    dept: i.dept,
    qty: i.qty,
    product: {
      id: i.product.id,
      name: i.product.name,
      variant: i.product.variant,
      category: i.product.category,
      unitCost: i.product.unitCost,
      inStock: i.product.inStock,
      git: i.product.git,
    },
  }));

  return (
    <IbsaAppShell active="ibsa-purchasing">
      <PurchasingClient conventions={conventionData} orderItems={orderItemData} />
    </IbsaAppShell>
  );
}
