import { prisma } from "../../../src/lib/prisma";
import IbsaAppShell from "../../../src/components/ibsa-app-shell";
import SuppliersClient, {
  type RsProductRow,
  type IbsaProductSlim,
} from "./SuppliersClient";

export default async function SuppliersPage() {
  const [rsProducts, ibsaProducts] = await Promise.all([
    prisma.rsProduct.findMany({
      include: {
        ibsaProduct: {
          select: {
            id: true,
            name: true,
            variant: true,
            code: true,
            category: true,
          },
        },
      },
      orderBy: [{ supplier: "asc" }, { createdAt: "asc" }],
    }),
    prisma.ibsaProduct.findMany({
      select: { id: true, name: true, variant: true, code: true, category: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
  ]);

  const rsData: RsProductRow[] = rsProducts.map((r) => ({
    id: r.id,
    supplier: r.supplier,
    rsCode: r.rsCode,
    rsVariant: r.rsVariant,
    rsDescription: r.rsDescription,
    cartonSize: r.cartonSize,
    cartonPrice: r.cartonPrice,
    notes: r.notes,
    ibsaProductId: r.ibsaProductId,
    ibsaProduct: r.ibsaProduct
      ? {
          id: r.ibsaProduct.id,
          name: r.ibsaProduct.name,
          variant: r.ibsaProduct.variant,
          code: r.ibsaProduct.code,
          category: r.ibsaProduct.category,
        }
      : null,
  }));

  const productsData: IbsaProductSlim[] = ibsaProducts.map((p) => ({
    id: p.id,
    name: p.name,
    variant: p.variant,
    code: p.code,
    category: p.category,
  }));

  return (
    <IbsaAppShell active="ibsa-suppliers">
      <SuppliersClient rsProducts={rsData} ibsaProducts={productsData} />
    </IbsaAppShell>
  );
}
