import { prisma } from "../../../src/lib/prisma";
import IbsaAppShell from "../../../src/components/ibsa-app-shell";
import PurchasingClient, { type BomComponentLine, type Convention, type OrderItemFlat, type RsProductLine } from "./purchasing-client";

export const dynamic = "force-dynamic";

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

  const GROUP_TYPE_LABEL: Record<string, string> = {
    regional: "Regional", circuit: "Circuit Assembly", congregation: "Congregation",
  };

  const [conventions, orderItems, groupOrders] = await Promise.all([
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
    prisma.ibsaGroupOrder.findMany({
      where: { status: { notIn: ["complete", "cancelled"] } },
      include: {
        lines: {
          include: {
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
        },
      },
    }),
  ]);

  const productIds = [...new Set(orderItems.map(i => i.product.id))];

  // Fetch BOM lines first so we know the component IDs
  const bomLinesRaw = productIds.length > 0
    ? await prisma.ibsaProductBom.findMany({
        where: { compositeId: { in: productIds } },
        select: {
          compositeId: true,
          componentId: true,
          qty: true,
          component: {
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
      })
    : [];

  // Fetch RS supplier links for direct order items AND BOM components
  const componentIds = bomLinesRaw.map(l => l.componentId);
  const allProductIdsForRs = [...new Set([...productIds, ...componentIds])];
  const rsProducts = allProductIdsForRs.length > 0
    ? await prisma.rsProduct.findMany({
        where: { ibsaProductId: { in: allProductIdsForRs } },
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

  // Group BOM lines by composite product ID
  const bomByComposite: Record<string, BomComponentLine[]> = {};
  for (const line of bomLinesRaw) {
    if (!bomByComposite[line.compositeId]) bomByComposite[line.compositeId] = [];
    bomByComposite[line.compositeId].push({
      componentId: line.componentId,
      qty: line.qty,
      componentProduct: {
        id: line.component.id,
        name: line.component.name,
        variant: line.component.variant,
        category: line.component.category,
        unitCost: line.component.unitCost,
        xyloCost: line.component.xyloCost,
        inStock: line.component.inStock,
        git: line.component.git,
      },
    });
  }

  // Merge group orders into convention + orderItem arrays
  // Use a far-future date so they always appear in the purchasing list
  const farFuture = new Date("2099-12-31").toISOString();
  const statusMap: Record<string, string> = { submitted: "pending", processing: "ordered" };

  const groupConventions: Convention[] = groupOrders.map(o => ({
    id: o.id,
    name: `${o.groupName} (${GROUP_TYPE_LABEL[o.groupType] ?? o.groupType})`,
    conventionDate: farFuture,
    status: statusMap[o.status] ?? "pending",
    collectionDate: null,
    faStatus: statusMap[o.status] ?? "pending",
    faCollectionDate: null,
  }));

  const groupOrderItems: OrderItemFlat[] = groupOrders.flatMap(o =>
    o.lines.map(l => ({
      conventionId: o.id,
      dept: l.dept,
      qty: l.qty,
      product: {
        id: l.product.id,
        name: l.product.name,
        variant: l.product.variant,
        category: l.product.category,
        unitCost: l.product.unitCost,
        xyloCost: l.product.xyloCost,
        inStock: l.product.inStock,
        git: l.product.git,
      },
    }))
  );

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

  const orderItemData: OrderItemFlat[] = [
    ...orderItems.map(i => ({
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
    })),
    ...groupOrderItems,
  ];

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
        conventions={[...conventionData, ...groupConventions]}
        orderItems={orderItemData}
        rsProducts={rsProductData}
        bomByComposite={bomByComposite}
      />
    </IbsaAppShell>
  );
}
