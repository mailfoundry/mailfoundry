"use client";

import { useState, useTransition } from "react";
import { updateProductStock, bulkUpdateInStock, updateProduct } from "./actions";

export type RsProductLink = {
  id: string;
  supplier: string;
  rsCode: string | null;
  rsVariant: string | null;
  rsDescription: string | null;
};

export type ProductRow = {
  id: string;
  name: string;
  variant: string | null;
  code: string;
  category: string;
  type: string;
  unitCost: number;
  xyloCost: number | null;
  inStock: number;
  git: number;
  rsProducts: RsProductLink[];
};

const CATEGORY_LABELS: Record<string, string> = {
  safety_ppe: "Safety & PPE",
  janitorial: "Janitorial",
  chemicals:  "Cleaning Chemicals",
  special:    "Special Order",
  firstaid:   "First Aid",
};

const CATEGORIES = [
  { value: "safety_ppe", label: "Safety & PPE" },
  { value: "janitorial", label: "Janitorial" },
  { value: "chemicals",  label: "Cleaning Chemicals" },
  { value: "special",    label: "Special Order" },
  { value: "firstaid",   label: "First Aid" },
];

type EditDraft = {
  name: string;
  variant: string;
  code: string;
  category: string;
  type: string;
  unitCost: string;
  xyloCost: string;
};

type Props = { products: ProductRow[] };

export default function ProductsClient({ products }: Props) {
  const [stockTakeMode, setStockTakeMode] = useState(false);
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [isSaving, startSaving] = useTransition();

  // Edit modal state
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft>({
    name: "", variant: "", code: "", category: "", type: "", unitCost: "", xyloCost: "",
  });
  // supplierDrafts: rsProductId → supplier name
  const [supplierDrafts, setSupplierDrafts] = useState<Map<string, string>>(new Map());
  const [isSavingEdit, startSavingEdit] = useTransition();

  // ── Derived ────────────────────────────────────────────────────────────
  const grouped = products.reduce<Record<string, ProductRow[]>>((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {});

  const getInStock = (p: ProductRow) =>
    stockTakeMode ? (draft[p.id] ?? p.inStock) : p.inStock;

  const totalInStock = products.reduce((s, p) => s + getInStock(p), 0);
  const totalGIT     = products.reduce((s, p) => s + p.git, 0);
  const totalStock   = totalInStock + totalGIT;
  const stockValue   = products.reduce(
    (s, p) => s + p.unitCost * (getInStock(p) + p.git), 0
  );

  const changedCount = stockTakeMode
    ? products.filter((p) => (draft[p.id] ?? p.inStock) !== p.inStock).length
    : 0;

  // ── Stock take ─────────────────────────────────────────────────────────
  const enterStockTake = () => {
    const init: Record<string, number> = {};
    for (const p of products) init[p.id] = p.inStock;
    setDraft(init);
    setStockTakeMode(true);
  };

  const cancelStockTake = () => { setDraft({}); setStockTakeMode(false); };

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

  const saveRow = (productId: string, inStock: number, git: number) => {
    const fd = new FormData();
    fd.append("productId", productId);
    fd.append("inStock", String(inStock));
    fd.append("git", String(git));
    updateProductStock(fd);
  };

  // ── Edit modal ─────────────────────────────────────────────────────────
  function openEdit(p: ProductRow) {
    setEditingProduct(p);
    setEditDraft({
      name:     p.name,
      variant:  p.variant ?? "",
      code:     p.code,
      category: p.category,
      type:     p.type,
      unitCost: String(p.unitCost),
      xyloCost: p.xyloCost != null ? String(p.xyloCost) : "",
    });
    const m = new Map<string, string>();
    for (const rp of p.rsProducts) m.set(rp.id, rp.supplier);
    setSupplierDrafts(m);
  }

  function saveEdit() {
    if (!editingProduct) return;

    // Only send supplier changes that actually differ from the original
    const supplierChanges = editingProduct.rsProducts
      .filter((rp) => supplierDrafts.get(rp.id) !== rp.supplier)
      .map((rp) => ({ id: rp.id, supplier: supplierDrafts.get(rp.id) ?? rp.supplier }));

    const fd = new FormData();
    fd.set("id",              editingProduct.id);
    fd.set("name",            editDraft.name);
    fd.set("variant",         editDraft.variant);
    fd.set("code",            editDraft.code);
    fd.set("category",        editDraft.category);
    fd.set("type",            editDraft.type);
    fd.set("unitCost",        editDraft.unitCost);
    fd.set("xyloCost",        editDraft.xyloCost);
    fd.set("supplierChanges", JSON.stringify(supplierChanges));

    startSavingEdit(async () => {
      await updateProduct(fd);
      setEditingProduct(null);
    });
  }

  const set = (field: keyof EditDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setEditDraft((prev) => ({ ...prev, [field]: e.target.value }));

  // Unique supplier names for datalist autocomplete
  const allSupplierNames = Array.from(
    new Set(products.flatMap((p) => p.rsProducts.map((rp) => rp.supplier)))
  ).sort();

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

      {/* Toolbar */}
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

      {/* Table */}
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
              <th className="px-5 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(grouped).map(([category, items]) => (
              <>
                <tr key={`cat-${category}`} className="border-t border-slate-700 bg-slate-700/30">
                  <td colSpan={10} className="px-5 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    {CATEGORY_LABELS[category] ?? category}
                  </td>
                </tr>
                {items.map((p) => {
                  const currentInStock = getInStock(p);
                  const total   = currentInStock + p.git;
                  const changed = stockTakeMode && (draft[p.id] ?? p.inStock) !== p.inStock;

                  return (
                    <tr
                      key={p.id}
                      className={`group border-t border-slate-700 ${
                        changed ? "bg-amber-950/20" : "hover:bg-slate-700/40"
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
                        {p.xyloCost != null && p.unitCost > 0 ? (() => {
                          const margin = ((p.unitCost - p.xyloCost) / p.unitCost) * 100;
                          return (
                            <span className={margin >= 30 ? "text-green-400" : margin >= 15 ? "text-amber-400" : "text-red-400"}>
                              {margin.toFixed(1)}%
                            </span>
                          );
                        })() : <span className="text-slate-500">—</span>}
                      </td>

                      {/* In Stock */}
                      <td className="px-5 py-3">
                        <div className="flex justify-center">
                          {stockTakeMode ? (
                            <input
                              type="number"
                              min="0"
                              value={draft[p.id] ?? p.inStock}
                              onChange={(e) =>
                                setDraft((prev) => ({ ...prev, [p.id]: parseInt(e.target.value) || 0 }))
                              }
                              className={`w-20 rounded border px-2 py-1 text-right text-white outline-none focus:border-amber-400 ${
                                changed ? "border-amber-500 bg-amber-950/40" : "border-slate-500 bg-slate-700"
                              }`}
                            />
                          ) : (
                            <input
                              key={p.id + "-instock"}
                              type="number"
                              min="0"
                              defaultValue={p.inStock}
                              onBlur={(e) => saveRow(p.id, parseInt(e.target.value) || 0, p.git)}
                              className="w-20 rounded border border-slate-500 bg-slate-700 px-2 py-1 text-right text-white outline-none focus:border-green-400"
                            />
                          )}
                        </div>
                      </td>

                      {/* GIT */}
                      <td className="px-5 py-3">
                        <div className="flex justify-center">
                          {stockTakeMode ? (
                            <span className="inline-block w-20 px-2 py-1 text-right text-slate-400">{p.git}</span>
                          ) : (
                            <input
                              key={p.id + "-git"}
                              type="number"
                              min="0"
                              defaultValue={p.git}
                              onBlur={(e) => saveRow(p.id, p.inStock, parseInt(e.target.value) || 0)}
                              className="w-20 rounded border border-slate-500 bg-slate-700 px-2 py-1 text-right text-white outline-none focus:border-amber-400"
                            />
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-3 text-right font-semibold">
                        <span className={total > 0 ? "text-white" : "text-slate-400"}>{total}</span>
                      </td>

                      {/* Edit button — hidden in stock take mode */}
                      <td className="px-3 py-3">
                        {!stockTakeMode && (
                          <button
                            onClick={() => openEdit(p)}
                            title="Edit product"
                            className="flex h-7 w-7 items-center justify-center rounded text-slate-600 opacity-0 transition-opacity hover:bg-slate-600 hover:text-white group-hover:opacity-100"
                          >
                            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                            </svg>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Edit modal ───────────────────────────────────────────────────── */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <div>
                <h2 className="text-base font-bold text-white">Edit product</h2>
                <p className="mt-0.5 text-xs text-slate-500 font-mono">{editingProduct.code}</p>
              </div>
              <button
                onClick={() => setEditingProduct(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {/* Fields */}
            <div className="space-y-4 px-6 py-5">
              {/* Name */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-400">Name</label>
                <input
                  type="text"
                  value={editDraft.name}
                  onChange={set("name")}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                />
              </div>

              {/* Variant */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-400">Variant / Size <span className="font-normal text-slate-600">(optional)</span></label>
                <input
                  type="text"
                  value={editDraft.variant}
                  onChange={set("variant")}
                  placeholder="e.g. Blue, 5L, Medium"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500 placeholder:text-slate-600"
                />
              </div>

              {/* Code */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-400">Product Code</label>
                <input
                  type="text"
                  value={editDraft.code}
                  onChange={set("code")}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-sm text-white outline-none focus:border-blue-500"
                />
              </div>

              {/* Category + Type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-400">Category</label>
                  <select
                    value={editDraft.category}
                    onChange={set("category")}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-400">Type</label>
                  <select
                    value={editDraft.type}
                    onChange={set("type")}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                  >
                    <option value="CS">CS — Cleaning Supplies</option>
                    <option value="FA">FA — First Aid</option>
                  </select>
                </div>
              </div>

              {/* Prices */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-400">Sale Price (ex VAT)</label>
                  <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 focus-within:border-blue-500">
                    <span className="text-sm text-slate-400">£</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editDraft.unitCost}
                      onChange={set("unitCost")}
                      className="w-full bg-transparent text-sm text-white outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-400">Xylo Cost <span className="font-normal text-slate-600">(optional)</span></label>
                  <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 focus-within:border-blue-500">
                    <span className="text-sm text-slate-400">£</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editDraft.xyloCost}
                      onChange={set("xyloCost")}
                      placeholder="—"
                      className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
                    />
                  </div>
                </div>
              </div>

              {/* Supplier Links */}
              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-400">
                  Supplier Links
                  <span className="ml-1 font-normal text-slate-600">— edit supplier name to re-assign PO grouping</span>
                </label>
                {editingProduct && editingProduct.rsProducts.length === 0 ? (
                  <p className="text-xs text-slate-600">
                    No supplier links yet. Add them on the{" "}
                    <a href="/ibsa/suppliers" className="text-blue-400 hover:underline">Suppliers page</a>.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {editingProduct?.rsProducts.map((rp) => (
                      <div key={rp.id} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/60 p-2.5">
                        {/* Editable supplier name */}
                        <input
                          type="text"
                          list="supplier-names"
                          value={supplierDrafts.get(rp.id) ?? rp.supplier}
                          onChange={(e) =>
                            setSupplierDrafts((prev) => new Map(prev).set(rp.id, e.target.value))
                          }
                          className="min-w-0 flex-1 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-white outline-none focus:border-blue-500"
                        />
                        {/* RS Code + Variant (read-only) */}
                        <div className="flex shrink-0 items-center gap-1.5">
                          {rp.rsCode ? (
                            <span className="font-mono text-xs text-slate-400">{rp.rsCode}</span>
                          ) : (
                            <span className="text-xs text-slate-600">no code</span>
                          )}
                          {rp.rsVariant && (
                            <span className="rounded bg-slate-700 px-1.5 py-0.5 text-xs text-slate-300">
                              {rp.rsVariant}
                            </span>
                          )}
                        </div>
                        {/* Changed indicator */}
                        {supplierDrafts.get(rp.id) !== rp.supplier && (
                          <span className="text-xs text-amber-400">✎</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {/* Datalist for supplier name autocomplete */}
                <datalist id="supplier-names">
                  {allSupplierNames.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </div>

              {/* Live margin preview */}
              {editDraft.unitCost && editDraft.xyloCost && parseFloat(editDraft.unitCost) > 0 && (() => {
                const sale = parseFloat(editDraft.unitCost);
                const cost = parseFloat(editDraft.xyloCost);
                const margin = ((sale - cost) / sale) * 100;
                return (
                  <p className={`text-xs font-semibold ${margin >= 30 ? "text-green-400" : margin >= 15 ? "text-amber-400" : "text-red-400"}`}>
                    Margin: {margin.toFixed(1)}% · Profit £{(sale - cost).toFixed(2)} per unit
                  </p>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 border-t border-slate-800 px-6 py-4">
              <button
                onClick={() => setEditingProduct(null)}
                disabled={isSavingEdit}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={isSavingEdit || !editDraft.name.trim() || !editDraft.code.trim()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40"
              >
                {isSavingEdit ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
