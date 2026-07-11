"use client";

import { useState, useTransition } from "react";
import { updateProductStock, bulkUpdateInStock } from "./actions";

export type ProductRow = {
  id: string;
  name: string;
  variant: string | null;
  code: string;
  category: string;
  unitCost: number;
  xyloCost: number | null;
  inStock: number;
  git: number;
};

const CATEGORY_LABELS: Record<string, string> = {
  safety_ppe: "Safety & PPE",
  janitorial: "Janitorial",
  chemicals: "Cleaning Chemicals",
  special: "Special Order",
  firstaid: "First Aid",
};

type Props = {
  products: ProductRow[];
};

export default function ProductsClient({ products }: Props) {
  const [stockTakeMode, setStockTakeMode] = useState(false);
  // draft holds the edited inStock values during a stock take
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [isSaving, startSaving] = useTransition();

  // ── Derived ────────────────────────────────────────────────────────────
  const grouped = products.reduce<Record<string, ProductRow[]>>((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {});

  const getInStock = (p: ProductRow) =>
    stockTakeMode ? (draft[p.id] ?? p.inStock) : p.inStock;

  const totalInStock = products.reduce((s, p) => s + getInStock(p), 0);
  const totalGIT = products.reduce((s, p) => s + p.git, 0);
  const totalStock = totalInStock + totalGIT;
  const stockValue = products.reduce(
    (s, p) => s + p.unitCost * (getInStock(p) + p.git),
    0
  );

  const changedCount = stockTakeMode
    ? products.filter((p) => (draft[p.id] ?? p.inStock) !== p.inStock).length
    : 0;

  // ── Stock take handlers ────────────────────────────────────────────────
  const enterStockTake = () => {
    const init: Record<string, number> = {};
    for (const p of products) init[p.id] = p.inStock;
    setDraft(init);
    setStockTakeMode(true);
  };

  const cancelStockTake = () => {
    setDraft({});
    setStockTakeMode(false);
  };

  const saveAll = () => {
    const updates = products
      .filter((p) => (draft[p.id] ?? p.inStock) !== p.inStock)
      .map((p) => ({ id: p.id, inStock: draft[p.id] ?? p.inStock }));

    startSaving(async () => {
      await bulkUpdateInStock(updates);
      setDraft({});
      setStockTakeMode(false);
    });
  };

  // ── Per-row blur save (normal mode only) ───────────────────────────────
  const saveRow = (productId: string, inStock: number, git: number) => {
    const fd = new FormData();
    fd.append("productId", productId);
    fd.append("inStock", String(inStock));
    fd.append("git", String(git));
    updateProductStock(fd);
  };

  return (
    <>
      {/* Stats */}
      <div className="mb-8 grid grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">SKUs</p>
          <p className="mt-1 text-3xl font-bold">{products.length}</p>
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

      {/* Stock take toolbar */}
      {stockTakeMode ? (
        <div className="mb-6 flex items-center justify-between rounded-xl border border-amber-700/50 bg-amber-950/20 px-5 py-3">
          <p className="text-sm text-amber-300">
            <span className="font-semibold">Stock Take Mode</span>
            {changedCount > 0
              ? ` — ${changedCount} product${changedCount !== 1 ? "s" : ""} changed`
              : " — edit quantities below"}
          </p>
          <div className="flex gap-3">
            <button
              onClick={cancelStockTake}
              disabled={isSaving}
              className="rounded-lg border border-slate-600 px-4 py-1.5 text-sm font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={saveAll}
              disabled={isSaving || changedCount === 0}
              className="rounded-lg bg-amber-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-40"
            >
              {isSaving ? "Saving…" : `Save All${changedCount > 0 ? ` (${changedCount})` : ""}`}
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-6 flex justify-end">
          <button
            onClick={enterStockTake}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
          >
            Stock Take
          </button>
        </div>
      )}

      {/* Products — single table so column widths are consistent across all categories */}
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
            {Object.entries(grouped).map(([category, items]) => (
              <>
                <tr key={`cat-${category}`} className="border-t border-slate-700 bg-slate-700/30">
                  <td colSpan={9} className="px-5 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    {CATEGORY_LABELS[category] ?? category}
                  </td>
                </tr>
                {items.map((p) => {
                  const currentInStock = getInStock(p);
                  const total = currentInStock + p.git;
                  const changed =
                    stockTakeMode && (draft[p.id] ?? p.inStock) !== p.inStock;

                  return (
                    <tr
                      key={p.id}
                      className={`border-t border-slate-700 ${
                        changed
                          ? "bg-amber-950/20"
                          : "hover:bg-slate-700/40"
                      }`}
                    >
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
                              const margin =
                                ((p.unitCost - p.xyloCost) / p.unitCost) * 100;
                              return (
                                <span
                                  className={
                                    margin >= 30
                                      ? "text-green-400"
                                      : margin >= 15
                                      ? "text-amber-400"
                                      : "text-red-400"
                                  }
                                >
                                  {margin.toFixed(1)}%
                                </span>
                              );
                            })()
                          : <span className="text-slate-500">—</span>}
                      </td>

                      {/* In Stock — controlled in stock take mode, blur-save in normal mode */}
                      <td className="px-5 py-3">
                        <div className="flex justify-center">
                          {stockTakeMode ? (
                            <input
                              type="number"
                              min="0"
                              value={draft[p.id] ?? p.inStock}
                              onChange={(e) =>
                                setDraft((prev) => ({
                                  ...prev,
                                  [p.id]: parseInt(e.target.value) || 0,
                                }))
                              }
                              className={`w-20 rounded border px-2 py-1 text-right text-white outline-none focus:border-amber-400 ${
                                changed
                                  ? "border-amber-500 bg-amber-950/40"
                                  : "border-slate-500 bg-slate-700"
                              }`}
                            />
                          ) : (
                            <input
                              key={p.id + "-instock"}
                              type="number"
                              min="0"
                              defaultValue={p.inStock}
                              onBlur={(e) =>
                                saveRow(
                                  p.id,
                                  parseInt(e.target.value) || 0,
                                  p.git
                                )
                              }
                              className="w-20 rounded border border-slate-500 bg-slate-700 px-2 py-1 text-right text-white outline-none focus:border-green-400"
                            />
                          )}
                        </div>
                      </td>

                      {/* GIT — always blur-save, read-only in stock take mode */}
                      <td className="px-5 py-3">
                        <div className="flex justify-center">
                          {stockTakeMode ? (
                            <span className="inline-block w-20 px-2 py-1 text-right text-slate-400">
                              {p.git}
                            </span>
                          ) : (
                            <input
                              key={p.id + "-git"}
                              type="number"
                              min="0"
                              defaultValue={p.git}
                              onBlur={(e) =>
                                saveRow(
                                  p.id,
                                  p.inStock,
                                  parseInt(e.target.value) || 0
                                )
                              }
                              className="w-20 rounded border border-slate-500 bg-slate-700 px-2 py-1 text-right text-white outline-none focus:border-amber-400"
                            />
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-3 text-right font-semibold">
                        <span className={total > 0 ? "text-white" : "text-slate-400"}>
                          {total}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
