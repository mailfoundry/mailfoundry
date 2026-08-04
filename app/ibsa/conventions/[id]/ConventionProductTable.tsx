"use client";

import { useState } from "react";
import ConventionQtyInput from "./ConventionQtyInput";
import { downloadPickList } from "./pickList";
import { downloadXeroExport } from "./xeroExport";

const CATEGORY_LABELS: Record<string, string> = {
  safety_ppe: "Safety & PPE",
  mops:       "Mops",
  janitorial: "Janitorial",
  gloves:     "Gloves",
  hivis:      "Hi Vis",
  brushes:    "Brushes & Handles",
  handles:    "Brushes & Handles",
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
  overrideMap: Record<string, number>;
  conventionId: string;
  conventionName: string;
  paymentDueDate: string | null;
  shippingCost: number;
  title: string;
  dept: "CS" | "FA";
};

export default function ConventionProductTable({ products, qtyMap, overrideMap, conventionId, conventionName, paymentDueDate, shippingCost, title, dept }: Props) {
  const [showAll, setShowAll] = useState(false);

  const orderedCount = products.filter((p) => (qtyMap[p.id] ?? 0) > 0).length;

  const handlePrintPickList = () => {
    downloadPickList({
      conventionName,
      dept,
      shippingCost,
      items: products.map((p) => ({
        code: p.code,
        name: p.name,
        variant: p.variant,
        category: p.category,
        qty: qtyMap[p.id] ?? 0,
        unitCost: p.unitCost,
      })),
    });
  };

  const handleXeroExport = () => {
    downloadXeroExport({
      conventionName,
      dept,
      paymentDueDate,
      items: products.map((p) => ({
        code: p.code,
        name: p.name,
        variant: p.variant,
        qty: qtyMap[p.id] ?? 0,
        unitCost: p.unitCost,
      })),
    });
  };

  const visibleProducts = showAll ? products : products.filter((p) => (qtyMap[p.id] ?? 0) > 0);

  const grouped = visibleProducts.reduce<Record<string, Product[]>>((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {});

  return (
    <section className="mb-10">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrintPickList}
            disabled={orderedCount === 0}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
          >
            Print pick list
          </button>
          <button
            onClick={handleXeroExport}
            disabled={orderedCount === 0}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
          >
            Export to Xero
          </button>
          <button
            onClick={() => setShowAll((v) => !v)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          >
            {showAll
              ? `Hide unordered`
              : `Show all products (${products.length - orderedCount} hidden)`}
          </button>
        </div>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <p className="text-sm text-gray-400">No products ordered yet.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-gray-500">
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
                  <tr key={`cat-${category}`} className="border-t border-gray-200 bg-gray-50">
                    <td colSpan={9} className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
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
                        ? "text-green-600"
                        : marginPct >= 15
                        ? "text-amber-600"
                        : "text-red-500";

                    return (
                      <tr
                        key={p.id}
                        className="border-t border-gray-100 transition-colors hover:bg-gray-50"
                      >
                        <td className="px-4 py-3 font-mono text-xs text-gray-400">{p.code}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                        <td className="px-4 py-3 text-gray-600">{p.variant ?? "—"}</td>
                        <td className="px-4 py-3 text-right text-gray-700">£{p.unitCost.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-gray-400">£{xyloCost.toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center">
                            <ConventionQtyInput conventionId={conventionId} productId={p.id} qty={qty} dept={dept} />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">
                          {lineSale > 0 ? `£${fmtGbp(lineSale)}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          {qty > 0 ? (
                            <span className={lineMarginGbp >= 0 ? "text-green-600" : "text-red-500"}>
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
