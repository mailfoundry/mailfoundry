import { prisma } from "../../../src/lib/prisma";
import IbsaAppShell from "../../../src/components/ibsa-app-shell";

const fmtGbp = (n: number) =>
  n.toLocaleString("en-GB", { style: "currency", currency: "GBP" });

const categoryLabel: Record<string, string> = {
  safety_ppe:  "Safety & PPE",
  chemicals:   "Chemicals",
  janitorial:  "Janitorial",
  special:     "Special",
};

export default async function PurchasingPage() {
  const orderItems = await prisma.ibsaOrderItem.findMany({
    where: { convention: { archivedAt: null } },
    include: { product: true },
  });

  // Aggregate ordered qty per product (sum CS + FA)
  type Row = {
    productId: string;
    code: string;
    name: string;
    variant: string | null;
    category: string;
    unitCost: number;
    inStock: number;
    gitQty: number;
    csOrdered: number;
    faOrdered: number;
  };

  const byProduct = new Map<string, Row>();

  for (const item of orderItems) {
    const p = item.product;
    if (!byProduct.has(p.id)) {
      byProduct.set(p.id, {
        productId: p.id,
        code: p.code,
        name: p.name,
        variant: p.variant,
        category: p.category,
        unitCost: p.unitCost,
        inStock: p.inStock,
        gitQty: p.gitQty ?? 0,
        csOrdered: 0,
        faOrdered: 0,
      });
    }
    const row = byProduct.get(p.id)!;
    if (item.dept === "CS") row.csOrdered += item.qty;
    else row.faOrdered += item.qty;
  }

  const rows = Array.from(byProduct.values())
    .map(r => ({
      ...r,
      totalOrdered: r.csOrdered + r.faOrdered,
      available: r.inStock + r.gitQty,
      deficit: r.csOrdered + r.faOrdered - (r.inStock + r.gitQty),
    }))
    .filter(r => r.deficit > 0)
    .sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return b.deficit - a.deficit;
    });

  const totalDeficitCost = rows.reduce((s, r) => s + r.deficit * r.unitCost, 0);
  const totalUnits = rows.reduce((s, r) => s + r.deficit, 0);

  // Group by category for display
  const byCategory = new Map<string, typeof rows>();
  for (const r of rows) {
    if (!byCategory.has(r.category)) byCategory.set(r.category, []);
    byCategory.get(r.category)!.push(r);
  }

  return (
    <IbsaAppShell active="ibsa-purchasing">
      <div className="max-w-6xl">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Purchasing</h1>
            <p className="mt-1 text-sm text-slate-400">
              Products where total ordered exceeds current stock + GIT
            </p>
          </div>
        </div>

        {/* Summary cards */}
        <div className="mb-8 grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Products to buy</p>
            <p className="mt-2 text-3xl font-bold text-white">{rows.length}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total units short</p>
            <p className="mt-2 text-3xl font-bold text-white">{totalUnits.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Est. purchase cost (ex VAT)</p>
            <p className="mt-2 text-3xl font-bold text-amber-400">{fmtGbp(totalDeficitCost)}</p>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-12 text-center">
            <p className="text-slate-400">All products are sufficiently stocked. Nothing to purchase.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Array.from(byCategory.entries()).map(([cat, catRows]) => (
              <div key={cat}>
                <h2 className="mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {categoryLabel[cat] ?? cat}
                </h2>
                <div className="overflow-hidden rounded-xl border border-slate-800">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/80 text-xs text-slate-500">
                        <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider">Product</th>
                        <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">CS Ordered</th>
                        <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">FA Ordered</th>
                        <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">In Stock</th>
                        <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">GIT</th>
                        <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">Short by</th>
                        <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">Unit cost</th>
                        <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">Est. cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 bg-slate-900">
                      {catRows.map(r => (
                        <tr key={r.productId} className="hover:bg-slate-800/50">
                          <td className="px-4 py-3">
                            <p className="font-medium text-white">{r.name}</p>
                            {r.variant && <p className="text-xs text-slate-500">{r.variant}</p>}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-slate-300">
                            {r.csOrdered > 0 ? r.csOrdered : <span className="text-slate-600">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-slate-300">
                            {r.faOrdered > 0 ? r.faOrdered : <span className="text-slate-600">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-slate-300">{r.inStock}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-slate-300">
                            {r.gitQty > 0 ? r.gitQty : <span className="text-slate-600">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="inline-block rounded-full bg-red-950/50 px-2.5 py-0.5 text-xs font-bold tabular-nums text-red-400 border border-red-800/40">
                              {r.deficit}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-slate-400">{fmtGbp(r.unitCost)}</td>
                          <td className="px-4 py-3 text-right tabular-nums font-semibold text-white">
                            {fmtGbp(r.deficit * r.unitCost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-slate-700 bg-slate-900/80">
                        <td colSpan={7} className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Subtotal
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-bold text-amber-400">
                          {fmtGbp(catRows.reduce((s, r) => s + r.deficit * r.unitCost, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </IbsaAppShell>
  );
}
