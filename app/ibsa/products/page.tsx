import Link from "next/link";
import { prisma } from "../../../src/lib/prisma";
import AppShell from "../../../src/components/app-shell";

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

  const totalProducts = products.length;
  const totalValue = products.reduce((sum, p) => sum + p.unitCost * p.inStock, 0);

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
          Cleaning Supplies ({activeType === "CS" ? totalProducts : "—"})
        </Link>
        <Link
          href="/ibsa/products?type=FA"
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${
            activeType === "FA"
              ? "bg-white text-slate-900"
              : "border border-slate-700 text-slate-400 hover:bg-slate-800"
          }`}
        >
          First Aid ({activeType === "FA" ? totalProducts : "—"})
        </Link>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">SKUs</p>
          <p className="mt-1 text-3xl font-bold">{totalProducts}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">In Stock (units)</p>
          <p className="mt-1 text-3xl font-bold">
            {products.reduce((s, p) => s + p.inStock, 0)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Stock Value</p>
          <p className="mt-1 text-3xl font-bold">
            £{totalValue.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                  <th className="px-6 py-3 font-medium">Product</th>
                  <th className="px-6 py-3 font-medium">Variant / Size</th>
                  <th className="px-6 py-3 font-medium">Code</th>
                  <th className="px-6 py-3 font-medium text-right">Unit Cost</th>
                  <th className="px-6 py-3 font-medium text-right">In Stock</th>
                  <th className="px-6 py-3 font-medium text-right">GIT</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p, i) => (
                  <tr
                    key={p.id}
                    className={`border-t border-slate-800 ${i % 2 === 0 ? "" : "bg-slate-900/30"}`}
                  >
                    <td className="px-6 py-3 font-medium text-white">
                      {p.name}
                    </td>
                    <td className="px-6 py-3 text-slate-400">
                      {p.variant ?? "—"}
                    </td>
                    <td className="px-6 py-3 font-mono text-xs text-slate-500">
                      {p.code}
                    </td>
                    <td className="px-6 py-3 text-right text-slate-300">
                      £{p.unitCost.toFixed(2)}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <span
                        className={
                          p.inStock > 0
                            ? "font-semibold text-green-400"
                            : "text-slate-600"
                        }
                      >
                        {p.inStock}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right text-slate-500">
                      {p.git > 0 ? p.git : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </AppShell>
  );
}
