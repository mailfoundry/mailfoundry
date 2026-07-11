import { prisma } from "../../../src/lib/prisma";
import IbsaAppShell from "../../../src/components/ibsa-app-shell";
import PurchasingClient, { type Convention, type OrderItemFlat, type RsProductLine } from "./purchasing-client";

export default async function PurchasingPage() {
  // Start of today so conventions happening today are still included
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Include a convention if either CS or FA is still outstanding
  const upcomingWhere = {
    archivedAt: null,
    conventionDate: { gte: today },
    OR: [
      { status: { not: "complete" } },
      { faStatus: { not: "complete" } },
    ],
  };

  const [conventions, orderItems] = await Promise.all([
    prisma.ibsaConvention.findMany({
      where: upcomingWhere,
      orderBy: [
        { collectionDate: { sort: "asc", nulls: "last" } },
        { conventionDate: "asc" },
      ],
      select: {
        id: true,
        name: true,
        conventionDate: true,
        status: true,
        collectionDate: true,
        faStatus: true,
        faCollectionDate: true,
      },
    }),
    prisma.ibsaOrderItem.findMany({
      where: { convention: upcomingWhere },
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
            xyloCost: true,
            inStock: true,
            git: true,
          },
        },
      },
    }),
  ]);

  // Fetch RS supplier products for all Xylo products that appear in order items
  const productIds = [...new Set(orderItems.map(i => i.product.id))];
  const rsProducts = productIds.length > 0
    ? await prisma.rsProduct.findMany({
        where: { ibsaProductId: { in: productIds } },
        select: {
          id: true,
          supplier: true,
          rsCode: true,
          rsVariant: true,
          rsDescription: true,
          cartonSize: true,
          cartonPrice: true,
          ibsaProductId: true,
        },
      })
    : [];

  // Serialise dates to strings for the client component
  const conventionData: Convention[] = conventions.map(c => ({
    id: c.id,
    name: c.name,
    conventionDate: c.conventionDate.toISOString(),
    status: c.status,
    collectionDate: c.collectionDate?.toISOString() ?? null,
    faStatus: c.faStatus,
    faCollectionDate: c.faCollectionDate?.toISOString() ?? null,
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
      xyloCost: i.product.xyloCost,
      inStock: i.product.inStock,
      git: i.product.git,
    },
  }));

  const rsProductData: RsProductLine[] = rsProducts.map(r => ({
    id: r.id,
    supplier: r.supplier,
    rsCode: r.rsCode ?? null,
    rsVariant: r.rsVariant ?? null,
    rsDescription: r.rsDescription ?? null,
    cartonSize: r.cartonSize ?? null,
    cartonPrice: r.cartonPrice ?? null,
    ibsaProductId: r.ibsaProductId ?? null,
  }));

  return (
    <IbsaAppShell active="ibsa-purchasing">
      <PurchasingClient
        conventions={conventionData}
        orderItems={orderItemData}
        rsProducts={rsProductData}
      />
    </IbsaAppShell>
  );
}
