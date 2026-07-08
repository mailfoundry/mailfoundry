import Link from "next/link";
import { prisma } from "../../../src/lib/prisma";
import AppShell from "../../../src/components/app-shell";
import { updateProductStock } from "./actions";

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
    <AppShell active="ibsa-products">
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
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
            {CATEGORY_LABELS[category] ?? category}
          </h3>
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-800 bg-slate-950/50 text-left text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Product</th>
                  <th className="px-5 py-3 font-medium">Variant / Size</th>
                  <th className="px-5 py-3 font-medium">Code</th>
                  <th className="px-5 py-3 font-medium text-right">Unit Cost</th>
                  <th className="px-5 py-3 font-medium text-right">In Stock</th>
                  <th className="px-5 py-3 font-medium text-right">GIT</th>
                  <th className="px-5 py-3 font-medium text-right">Total Stock</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => {
                  const total = p.inStock + p.git;
                  return (
                    <tr key={p.id} className="border-t border-slate-800">
                      <td className="px-5 py-3 font-medium text-white">{p.name}</td>
                      <td className="px-5 py-3 text-slate-400">{p.variant ?? "—"}</td>
                      <td className="px-5 py-3 font-mono text-xs text-slate-500">{p.code}</td>
                      <td className="px-5 py-3 text-right text-slate-300">£{p.unitCost.toFixed(2)}</td>

                      {/* In Stock — editable */}
                      <td className="px-5 py-3 text-right">
                        <form action={updateProductStock} className="flex items-center justify-end gap-1">
                          <input type="hidden" name="productId" value={p.id} />
                          <input type="hidden" name="git" value={p.git} />
                          <input
                            type="number"
                            name="inStock"
                            min="0"
                            defaultValue={p.inStock}
                            className="w-20 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-right text-white outline-none focus:border-green-500"
                          />
                          <button
                            type="submit"
                            className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-600"
                          >
                            ✓
                          </button>
                        </form>
                      </td>

                      {/* GIT — editable */}
                      <td className="px-5 py-3 text-right">
                        <form action={updateProductStock} className="flex items-center justify-end gap-1">
                          <input type="hidden" name="productId" value={p.id} />
                          <input type="hidden" name="inStock" value={p.inStock} />
                          <input
                            type="number"
                            name="git"
                            min="0"
                            defaultValue={p.git}
                            className="w-20 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-right text-white outline-none focus:border-amber-500"
                          />
                          <button
                            type="submit"
                            className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-600"
                          >
                            ✓
                          </button>
                        </form>
                      </td>

                      {/* Total Stock — computed */}
                      <td className="px-5 py-3 text-right font-semibold">
                        <span className={total > 0 ? "text-white" : "text-slate-600"}>
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
    </AppShell>
  );
}
