"use client";

import { useState } from "react";
import ConventionQtyInput from "./ConventionQtyInput";

const CATEGORY_LABELS: Record<string, string> = {
  safety_ppe: "Safety & PPE",
  janitorial: "Janitorial",
  chemicals: "Cleaning Chemicals",
  special: "Special Order",
  firstaid: "First Aid",
};

const fmtGbp = (n: number) =>
  n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Product = {
  id: string;
  code: string;
  name: string;
  variant: string | null;
  unitCost: number;
  xyloCost: number | null;
  category: string;
  type: string;
};

type Props = {
  products: Product[];
  qtyMap: Record<string, number>;
  conventionId: string;
  title: string;
};

export default function ConventionProductTable({ products, qtyMap, conventionId, title }: Props) {
  const [showAll, setShowAll] = useState(false);

  const orderedCount = products.filter((p) => (qtyMap[p.id] ?? 0) > 0).length;

  const visibleProducts = showAll ? products : products.filter((p) => (qtyMap[p.id] ?? 0) > 0);

  const grouped = visibleProducts.reduce<Record<string, Product[]>>((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {});

  return (
    <section className="mb-10">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">{title}</h3>
        <button
          onClick={() => setShowAll((v) => !v)}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          {showAll
            ? `Hide unordered`
            : `Show all products (${products.length - orderedCount} hidden)`}
        </button>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <p className="text-sm text-slate-500">No products ordered yet.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-700 bg-slate-700/50 text-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Code</th>
                <th className="px-4 py-3 text-left font-semibold">Product</th>
                <th className="px-4 py-3 text-left font-semibold">Variant</th>
                <th className="px-4 py-3 text-right font-semibold">Sale</th>
                <th className="px-4 py-3 text-right font-semibold">Cost</th>
                <th className="px-4 py-3 text-center font-semibold">Qty</th>
                <th className="px-4 py-3 text-right font-semibold">Line Sale</th>
                <th className="px-4 py-3 text-right font-semibold">Margin £</th>
                <th className="px-4 py-3 text-right font-semibold">Margin %</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(grouped).map(([category, items]) => (
                <>
                  {/* Category divider row */}
                  <tr key={`cat-${category}`} className="border-t border-slate-700 bg-slate-700/30">
                    <td colSpan={9} className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      {CATEGORY_LABELS[category] ?? category}
                    </td>
                  </tr>
                  {items.map((p) => {
                    const qty = qtyMap[p.id] ?? 0;
                    const xyloCost = p.xyloCost ?? p.unitCost;
                    const lineSale = qty * p.unitCost;
                    const lineMarginGbp = qty * (p.unitCost - xyloCost);
                    const marginPct =
                      p.unitCost > 0 ? ((p.unitCost - xyloCost) / p.unitCost) * 100 : 0;
                    const marginColour =
                      marginPct >= 30
                        ? "text-green-400"
                        : marginPct >= 15
                        ? "text-amber-400"
                        : "text-red-400";

                    return (
                      <tr
                        key={p.id}
                        className="border-t border-slate-700/50 transition-opacity hover:bg-slate-700/30"
                      >
                        <td className="px-4 py-3 font-mono text-xs text-slate-400">{p.code}</td>
                        <td className="px-4 py-3 font-medium text-white">{p.name}</td>
                        <td className="px-4 py-3 text-slate-300">{p.variant ?? "—"}</td>
                        <td className="px-4 py-3 text-right text-slate-200">£{p.unitCost.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-slate-400">£{xyloCost.toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center">
                            <ConventionQtyInput conventionId={conventionId} productId={p.id} qty={qty} />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-200">
                          {lineSale > 0 ? `£${fmtGbp(lineSale)}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          {qty > 0 ? (
                            <span className={lineMarginGbp >= 0 ? "text-green-400" : "text-red-400"}>
                              £{fmtGbp(lineMarginGbp)}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={marginColour}>{marginPct.toFixed(1)}%</span>
                        </td>
                      </tr>
                    );
                  })}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
