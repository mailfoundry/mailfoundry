import Link from "next/link";
import { prisma } from "../../../src/lib/prisma";
import IbsaAppShell from "../../../src/components/ibsa-app-shell";
import ProductStockInput from "./ProductStockInput";

const CATEGORY_LABELS: Record<string, string> = {
  safety_ppe: "Safety & PPE",
  janitorial: "Janitorial",
  chemicals: "Cleaning Chemicals",
  special: "Special Order",
  firstaid: "First Aid",
};

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
  });

  // Group by category
  const grouped = products.reduce<Record<string, typeof products>>(
    (acc, p) => {
      if (!acc[p.category]) acc[p.category] = [];
      acc[p.category].push(p);
      return acc;
    },
    {}
  );

  const totalSKUs = products.length;
  const totalInStock = products.reduce((s, p) => s + p.inStock, 0);
  const totalGIT = products.reduce((s, p) => s + p.git, 0);
  const totalStock = totalInStock + totalGIT;
  const stockValue = products.reduce((s, p) => s + p.unitCost * (p.inStock + p.git), 0);

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
          Cleaning Supplies ({activeType === "CS" ? totalSKUs : "—"})
        </Link>
        <Link
          href="/ibsa/products?type=FA"
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${
            activeType === "FA"
              ? "bg-white text-slate-900"
              : "border border-slate-700 text-slate-400 hover:bg-slate-800"
          }`}
        >
          First Aid ({activeType === "FA" ? totalSKUs : "—"})
        </Link>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">SKUs</p>
          <p className="mt-1 text-3xl font-bold">{totalSKUs}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">In Stock</p>
          <p className="mt-1 text-3xl font-bold text-green-400">{totalInStock}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">GIT</p>
          <p className="mt-1 text-3xl font-bold text-amber-400">{totalGIT}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Total Stock</p>
          <p className="mt-1 text-3xl font-bold">{totalStock}</p>
          <p className="mt-1 text-xs text-slate-500">
            £{stockValue.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} value
          </p>
        </div>
      </div>

      {/* Products by category */}
      {Object.entries(grouped).map(([category, items]) => (
        <section key={category} className="mb-8">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-300">
            {CATEGORY_LABELS[category] ?? category}
          </h3>
          <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-700 bg-slate-700/50 text-left text-slate-200">
                <tr>
                  <th className="px-5 py-3 font-semibold">Product</th>
                  <th className="px-5 py-3 font-semibold">Variant / Size</th>
                  <th className="px-5 py-3 font-semibold">Code</th>
                  <th className="px-5 py-3 font-semibold text-right">Sale Price</th>
                  <th className="px-5 py-3 font-semibold text-right">Xylo Cost</th>
                  <th className="px-5 py-3 font-semibold text-right">Margin %</th>
                  <th className="px-5 py-3 font-semibold text-center">In Stock</th>
                  <th className="px-5 py-3 font-semibold text-center">GIT</th>
                  <th className="px-5 py-3 font-semibold text-right">Total Stock</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => {
                  const total = p.inStock + p.git;
                  return (
                    <tr key={p.id} className="border-t border-slate-700 hover:bg-slate-700/40">
                      <td className="px-5 py-3 font-medium text-white">{p.name}</td>
                      <td className="px-5 py-3 text-slate-300">{p.variant ?? "—"}</td>
                      <td className="px-5 py-3 font-mono text-xs text-slate-400">{p.code}</td>
                      <td className="px-5 py-3 text-right text-slate-200">£{p.unitCost.toFixed(2)}</td>
                      <td className="px-5 py-3 text-right text-slate-300">
                        {p.xyloCost != null ? `£${p.xyloCost.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-5 py-3 text-right font-medium">
                        {p.xyloCost != null && p.unitCost > 0
                          ? (() => {
                              const margin = ((p.unitCost - p.xyloCost) / p.unitCost) * 100;
                              return (
                                <span className={margin >= 30 ? "text-green-400" : margin >= 15 ? "text-amber-400" : "text-red-400"}>
                                  {margin.toFixed(1)}%
                                </span>
                              );
                            })()
                          : <span className="text-slate-500">—</span>}
                      </td>

                      <ProductStockInput
                        productId={p.id}
                        inStock={p.inStock}
                        git={p.git}
                      />

                      {/* Total Stock — computed */}
                      <td className="px-5 py-3 text-right font-semibold">
                        <span className={total > 0 ? "text-white" : "text-slate-400"}>
                          {total}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </IbsaAppShell>
  );
}
