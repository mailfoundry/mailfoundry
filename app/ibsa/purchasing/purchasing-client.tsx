"use client";

import { useState, useMemo } from "react";

const fmtGbp = (n: number) =>
  n.toLocaleString("en-GB", { style: "currency", currency: "GBP" });

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

const daysFromNow = (iso: string) => {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.round(diff / 86_400_000);
};

const categoryLabel: Record<string, string> = {
  safety_ppe: "Safety & PPE",
  firstaid:   "First Aid",
  chemicals:  "Chemicals",
  janitorial: "Janitorial",
  special:    "Special",
};

export type Convention = {
  id: string;
  name: string;
  conventionDate: string;
};

export type OrderItemFlat = {
  conventionId: string;
  dept: string;
  qty: number;
  product: {
    id: string;
    name: string;
    variant: string | null;
    category: string;
    unitCost: number;
    inStock: number;
    git: number;
  };
};

type Props = {
  conventions: Convention[];
  orderItems: OrderItemFlat[];
};

export default function PurchasingClient({ conventions, orderItems }: Props) {
  const [selected, setSelected] = useState<Set<string>>(() => {
    // Default: pre-select the next upcoming convention
    const upcoming = conventions.filter(c => daysFromNow(c.conventionDate) >= 0);
    if (upcoming.length > 0) return new Set([upcoming[0].id]);
    return new Set();
  });

  const toggle = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const selectAll = () => setSelected(new Set(conventions.map(c => c.id)));
  const clearAll  = () => setSelected(new Set());

  const rows = useMemo(() => {
    if (selected.size === 0) return [];

    type Acc = {
      productId: string;
      name: string;
      variant: string | null;
      category: string;
      unitCost: number;
      inStock: number;
      git: number;
      csOrdered: number;
      faOrdered: number;
    };

    const byProduct = new Map<string, Acc>();

    for (const item of orderItems) {
      if (!selected.has(item.conventionId)) continue;
      const p = item.product;
      if (!byProduct.has(p.id)) {
        byProduct.set(p.id, {
          productId: p.id,
          name: p.name,
          variant: p.variant,
          category: p.category,
          unitCost: p.unitCost,
          inStock: p.inStock,
          git: p.git,
          csOrdered: 0,
          faOrdered: 0,
        });
      }
      const row = byProduct.get(p.id)!;
      if (item.dept === "CS") row.csOrdered += item.qty;
      else row.faOrdered += item.qty;
    }

    return Array.from(byProduct.values())
      .map(r => ({
        ...r,
        deficit: r.csOrdered + r.faOrdered - (r.inStock + r.git),
      }))
      .filter(r => r.deficit > 0)
      .sort((a, b) => {
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        return b.deficit - a.deficit;
      });
  }, [orderItems, selected]);

  const byCategory = useMemo(() => {
    const map = new Map<string, typeof rows>();
    for (const r of rows) {
      if (!map.has(r.category)) map.set(r.category, []);
      map.get(r.category)!.push(r);
    }
    return map;
  }, [rows]);

  const totalCost  = rows.reduce((s, r) => s + r.deficit * r.unitCost, 0);
  const totalUnits = rows.reduce((s, r) => s + r.deficit, 0);

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Purchasing</h1>
        <p className="mt-1 text-sm text-slate-400">
          Select the conventions you&apos;re buying for to see what you&apos;re short on.
        </p>
      </div>

      {/* Convention selector */}
      <div className="mb-8 rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-white">Conventions</p>
          <div className="flex gap-3 text-xs">
            <button onClick={selectAll} className="text-slate-400 hover:text-white transition-colors">Select all</button>
            <span className="text-slate-700">·</span>
            <button onClick={clearAll} className="text-slate-400 hover:text-white transition-colors">Clear</button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {conventions.map(c => {
            const days = daysFromNow(c.conventionDate);
            const isSelected = selected.has(c.id);
            const soon = days >= 0 && days <= 14;
            return (
              <button
                key={c.id}
                onClick={() => toggle(c.id)}
                className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-all ${
                  isSelected
                    ? "border-blue-700 bg-blue-950/40"
                    : "border-slate-800 hover:border-slate-600 hover:bg-slate-800/50"
                }`}
              >
                {/* Checkbox */}
                <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                  isSelected ? "border-blue-500 bg-blue-600" : "border-slate-600"
                }`}>
                  {isSelected && (
                    <svg className="h-2.5 w-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 12 12">
                      <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span>
                  <span className="block text-sm font-medium text-white">{c.name}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                    {fmtDate(c.conventionDate)}
                    {soon && (
                      <span className="rounded-full bg-amber-900/50 border border-amber-700/40 px-1.5 py-0 text-amber-400">
                        {days === 0 ? "today" : `${days}d`}
                      </span>
                    )}
                    {days < 0 && (
                      <span className="rounded-full bg-slate-800 px-1.5 py-0 text-slate-500">
                        past
                      </span>
                    )}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Results */}
      {selected.size === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-12 text-center">
          <p className="text-slate-400">Select one or more conventions above to see what you need to buy.</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-12 text-center">
          <p className="text-slate-400">You&apos;re fully stocked for the selected conventions. Nothing to buy.</p>
        </div>
      ) : (
        <>
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
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Est. cost (ex VAT)</p>
              <p className="mt-2 text-3xl font-bold text-amber-400">{fmtGbp(totalCost)}</p>
            </div>
          </div>

          {/* Tables by category */}
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
                        <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">CS</th>
                        <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">FA</th>
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
                            {r.git > 0 ? r.git : <span className="text-slate-600">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="inline-block rounded-full border border-red-800/40 bg-red-950/50 px-2.5 py-0.5 text-xs font-bold tabular-nums text-red-400">
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
        </>
      )}
    </div>
  );
}
