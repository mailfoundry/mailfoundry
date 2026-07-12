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
      inStock: true,
      git: true,
    },
  });

  return (
    <IbsaAppShell active="ibsa-products">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">IBSA · Xylo Supplies</p>
          <h2 className="text-3xl font-bold">Products</h2>
        </div>
        <Link
          href="/ibsa"
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
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
              ? "bg-white text-slate-900"
              : "border border-slate-700 text-slate-400 hover:bg-slate-800"
          }`}
        >
          Cleaning Supplies
        </Link>
        <Link
          href="/ibsa/products?type=FA"
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${
            activeType === "FA"
              ? "bg-white text-slate-900"
              : "border border-slate-700 text-slate-400 hover:bg-slate-800"
          }`}
        >
          First Aid
        </Link>
      </div>

      <ProductsClient products={products} />
    </IbsaAppShell>
  );
}
