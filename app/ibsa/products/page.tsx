import Link from "next/link";
import { prisma } from "../../../src/lib/prisma";
import IbsaAppShell from "../../../src/components/ibsa-app-shell";
import ProductsClient from "./ProductsClient";

export default async function IbsaProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const activeType = type === "FA" ? "FA" : "CS";

  const products = await prisma.ibsaProduct.findMany({
    where: { type: activeType },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      variant: true,
      code: true,
      category: true,
      type: true,
      unitCost: true,
      xyloCost: true,
      description: true,
      imageUrl: true,
      groupImageUrl: true,
      groupWithVariants: true,
      groupDescription: true,
      visibleInOrderForm: true,
      inStock: true,
      git: true,
      rsProducts: {
        select: { id: true, supplier: true, rsCode: true, rsVariant: true, rsDescription: true, cartonSize: true, cartonPrice: true },
        orderBy: { supplier: "asc" as const },
      },
      bomAsComposite: {
        select: {
          id: true,
          componentId: true,
          qty: true,
          component: {
            select: { id: true, code: true, name: true, variant: true },
          },
        },
        orderBy: { createdAt: "asc" as const },
      },
    },
  });

  return (
    <IbsaAppShell active="ibsa-products">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">IBSA · Xylo Supplies</p>
          <h2 className="text-3xl font-bold text-gray-900">Products</h2>
        </div>
        <Link
          href="/ibsa"
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
        >
          ← Conventions
        </Link>
      </header>

      {/* Type Tabs */}
      <div className="mb-8 flex gap-2">
        <Link
          href="/ibsa/products?type=CS"
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${
            activeType === "CS"
              ? "bg-gray-900 text-white"
              : "border border-gray-200 text-gray-500 hover:bg-gray-100"
          }`}
        >
          Cleaning Supplies
        </Link>
        <Link
          href="/ibsa/products?type=FA"
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${
            activeType === "FA"
              ? "bg-gray-900 text-white"
              : "border border-gray-200 text-gray-500 hover:bg-gray-100"
          }`}
        >
          First Aid
        </Link>
      </div>

      <ProductsClient products={products} activeType={activeType} />
    </IbsaAppShell>
  );
}
