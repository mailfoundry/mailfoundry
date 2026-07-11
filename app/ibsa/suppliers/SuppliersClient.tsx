"use client";

import { useState, useTransition } from "react";
import { createRsProduct, updateRsProduct, deleteRsProduct } from "./actions";

export type IbsaProductSlim = {
  id: string;
  name: string;
  variant: string | null;
  code: string;
  category: string;
};

export type RsProductRow = {
  id: string;
  supplier: string;
  rsCode: string | null;
  rsVariant: string | null;
  rsDescription: string | null;
  cartonSize: number | null;
  cartonPrice: number | null;
  notes: string | null;
  ibsaProductId: string | null;
  ibsaProduct: IbsaProductSlim | null;
};

type Draft = {
  supplier: string;
  ibsaProductId: string;
  rsCode: string;
  rsDescription: string;
  rsVariant: string;
  cartonSize: string;
  cartonPrice: string;
  notes: string;
};

const EMPTY_DRAFT: Draft = {
  supplier: "",
  ibsaProductId: "",
  rsCode: "",
  rsDescription: "",
  rsVariant: "",
  cartonSize: "",
  cartonPrice: "",
  notes: "",
};

const CATEGORY_LABELS: Record<string, string> = {
  safety_ppe: "Safety & PPE",
  janitorial: "Janitorial",
  chemicals: "Chemicals",
  firstaid: "First Aid",
  special: "Special",
};

function groupBySupplier(rows: RsProductRow[]) {
  const map = new Map<string, RsProductRow[]>();
  for (const row of rows) {
    if (!map.has(row.supplier)) map.set(row.supplier, []);
    map.get(row.supplier)!.push(row);
  }
  for (const group of map.values()) {
    group.sort((a, b) => {
      if (a.rsCode && !b.rsCode) return -1;
      if (!a.rsCode && b.rsCode) return 1;
      if (a.rsCode && b.rsCode) return a.rsCode.localeCompare(b.rsCode);
      return (a.ibsaProduct?.name ?? "").localeCompare(b.ibsaProduct?.name ?? "");
    });
  }
  return new Map([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function groupProductsByCategory(products: IbsaProductSlim[]) {
  const map = new Map<string, IbsaProductSlim[]>();
  for (const p of products) {
    if (!map.has(p.category)) map.set(p.category, []);
    map.get(p.category)!.push(p);
  }
  return map;
}

export default function SuppliersClient({
  rsProducts,
  ibsaProducts,
}: {
  rsProducts: RsProductRow[];
  ibsaProducts: IbsaProductSlim[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY_DRAFT);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addDraft, setAddDraft] = useState<Draft>(EMPTY_DRAFT);
  const [isPending, startTransition] = useTransition();

  const supplierGroups = groupBySupplier(rsProducts);
  const supplierNames = [...supplierGroups.keys()];
  const productsByCategory = groupProductsByCategory(ibsaProducts);

  const inputCls =
    "w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none";
  const th = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap";
  const td = "px-3 py-2 text-sm align-top";

  function ProductSelect({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      >
        <option value="">— unlinked —</option>
        {[...productsByCategory.entries()].map(([cat, products]) => (
          <optgroup key={cat} label={CATEGORY_LABELS[cat] ?? cat}>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.variant ? ` (${p.variant})` : ""} · {p.code}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    );
  }

  function startEdit(row: RsProductRow) {
    setEditingId(row.id);
    setEditDraft({
      supplier: row.supplier,
      ibsaProductId: row.ibsaProductId ?? "",
      rsCode: row.rsCode ?? "",
      rsDescription: row.rsDescription ?? "",
      rsVariant: row.rsVariant ?? "",
      cartonSize: row.cartonSize?.toString() ?? "",
      cartonPrice: row.cartonPrice?.toString() ?? "",
      notes: row.notes ?? "",
    });
  }

  function handleSave(id: string) {
    const formData = new FormData();
    formData.set("id", id);
    for (const [k, v] of Object.entries(editDraft)) formData.set(k, v);
    startTransition(async () => {
      await updateRsProduct(formData);
      setEditingId(null);
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this supplier row?")) return;
    const formData = new FormData();
    formData.set("id", id);
    startTransition(async () => {
      await deleteRsProduct(formData);
    });
  }

  function handleAdd() {
    const formData = new FormData();
    for (const [k, v] of Object.entries(addDraft)) formData.set(k, v);
    startTransition(async () => {
      await createRsProduct(formData);
      setShowAddForm(false);
      setAddDraft(EMPTY_DRAFT);
    });
  }

  function openAddForm(supplier?: string) {
    setAddDraft({ ...EMPTY_DRAFT, supplier: supplier ?? "" });
    setShowAddForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="space-y-10">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Suppliers</h1>
          <p className="mt-1 text-sm text-slate-400">
            {rsProducts.length} rows across {supplierNames.length} supplier
            {supplierNames.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => openAddForm()}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          + Add product
        </button>
      </div>

      {/* Add form panel */}
      {showAddForm && (
        <div className="rounded-xl border border-indigo-500/30 bg-slate-900 p-6">
          <h2 className="mb-4 text-base font-semibold text-white">
            Add supplier row
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs text-slate-400">
                Supplier *
              </label>
              <input
                value={addDraft.supplier}
                onChange={(e) =>
                  setAddDraft((d) => ({ ...d, supplier: e.target.value }))
                }
                list="supplier-list"
                placeholder="e.g. Robert Scott"
                className={inputCls}
              />
              <datalist id="supplier-list">
                {supplierNames.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">
                Xylo Product
              </label>
              <ProductSelect
                value={addDraft.ibsaProductId}
                onChange={(v) =>
                  setAddDraft((d) => ({ ...d, ibsaProductId: v }))
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">
                Supplier Code
              </label>
              <input
                value={addDraft.rsCode}
                onChange={(e) =>
                  setAddDraft((d) => ({ ...d, rsCode: e.target.value }))
                }
                placeholder="e.g. 102855"
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">
                Description
              </label>
              <input
                value={addDraft.rsDescription}
                onChange={(e) =>
                  setAddDraft((d) => ({ ...d, rsDescription: e.target.value }))
                }
                placeholder="e.g. Contractor Mop Refill 400g"
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">
                Variant
              </label>
              <input
                value={addDraft.rsVariant}
                onChange={(e) =>
                  setAddDraft((d) => ({ ...d, rsVariant: e.target.value }))
                }
                placeholder="e.g. BLUE"
                className={inputCls}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs text-slate-400">
                  Carton size
                </label>
                <input
                  value={addDraft.cartonSize}
                  onChange={(e) =>
                    setAddDraft((d) => ({ ...d, cartonSize: e.target.value }))
                  }
                  type="number"
                  min="1"
                  placeholder="e.g. 10"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">
                  £/Carton
                </label>
                <input
                  value={addDraft.cartonPrice}
                  onChange={(e) =>
                    setAddDraft((d) => ({ ...d, cartonPrice: e.target.value }))
                  }
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 14.50"
                  className={inputCls}
                />
              </div>
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-xs text-slate-400">Notes</label>
              <input
                value={addDraft.notes}
                onChange={(e) =>
                  setAddDraft((d) => ({ ...d, notes: e.target.value }))
                }
                placeholder="Optional notes"
                className={inputCls}
              />
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleAdd}
              disabled={!addDraft.supplier || isPending}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-400 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Supplier sections */}
      {[...supplierGroups.entries()].map(([supplier, rows]) => {
        const pendingCount = rows.filter((r) => !r.rsCode && !r.rsDescription).length;

        return (
          <section key={supplier}>
            <div className="mb-3 flex items-center gap-3">
              <h2 className="text-lg font-semibold text-white">{supplier}</h2>
              <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-400">
                {rows.length}
              </span>
              {pendingCount > 0 && (
                <span className="rounded-full bg-amber-900/40 px-2.5 py-0.5 text-xs text-amber-400">
                  {pendingCount} without catalog data
                </span>
              )}
              <button
                onClick={() => openAddForm(supplier)}
                className="ml-auto text-xs text-indigo-400 hover:text-indigo-300"
              >
                + Add product
              </button>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-800">
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col style={{ width: "22%" }} />
                  <col style={{ width: "9%" }} />
                  <col style={{ width: "21%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "17%" }} />
                  <col style={{ width: "8%" }} />
                </colgroup>
                <thead className="border-b border-slate-800 bg-slate-900">
                  <tr>
                    <th className={th}>Xylo Product</th>
                    <th className={th}>Code</th>
                    <th className={th}>Description</th>
                    <th className={th}>Variant</th>
                    <th className={`${th} text-right`}>Carton</th>
                    <th className={`${th} text-right`}>£/Carton</th>
                    <th className={th}>Notes</th>
                    <th className={th}></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {rows.map((row) => {
                    // ── Edit row ──────────────────────────────────────────────
                    if (editingId === row.id) {
                      return (
                        <tr key={row.id} className="bg-slate-900/80">
                          <td className={td}>
                            <ProductSelect
                              value={editDraft.ibsaProductId}
                              onChange={(v) =>
                                setEditDraft((d) => ({
                                  ...d,
                                  ibsaProductId: v,
                                }))
                              }
                            />
                            <input
                              value={editDraft.supplier}
                              onChange={(e) =>
                                setEditDraft((d) => ({
                                  ...d,
                                  supplier: e.target.value,
                                }))
                              }
                              list="supplier-list"
                              placeholder="Supplier"
                              className={`${inputCls} mt-1`}
                            />
                          </td>
                          <td className={td}>
                            <input
                              value={editDraft.rsCode}
                              onChange={(e) =>
                                setEditDraft((d) => ({
                                  ...d,
                                  rsCode: e.target.value,
                                }))
                              }
                              placeholder="Code"
                              className={inputCls}
                            />
                          </td>
                          <td className={td}>
                            <input
                              value={editDraft.rsDescription}
                              onChange={(e) =>
                                setEditDraft((d) => ({
                                  ...d,
                                  rsDescription: e.target.value,
                                }))
                              }
                              placeholder="Description"
                              className={inputCls}
                            />
                          </td>
                          <td className={td}>
                            <input
                              value={editDraft.rsVariant}
                              onChange={(e) =>
                                setEditDraft((d) => ({
                                  ...d,
                                  rsVariant: e.target.value,
                                }))
                              }
                              placeholder="Variant"
                              className={inputCls}
                            />
                          </td>
                          <td className={td}>
                            <input
                              value={editDraft.cartonSize}
                              onChange={(e) =>
                                setEditDraft((d) => ({
                                  ...d,
                                  cartonSize: e.target.value,
                                }))
                              }
                              type="number"
                              min="1"
                              placeholder="0"
                              className={`${inputCls} text-right`}
                            />
                          </td>
                          <td className={td}>
                            <input
                              value={editDraft.cartonPrice}
                              onChange={(e) =>
                                setEditDraft((d) => ({
                                  ...d,
                                  cartonPrice: e.target.value,
                                }))
                              }
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              className={`${inputCls} text-right`}
                            />
                          </td>
                          <td className={td}>
                            <input
                              value={editDraft.notes}
                              onChange={(e) =>
                                setEditDraft((d) => ({
                                  ...d,
                                  notes: e.target.value,
                                }))
                              }
                              placeholder="Notes"
                              className={inputCls}
                            />
                          </td>
                          <td className={`${td} text-right`}>
                            <div className="flex flex-col gap-1">
                              <button
                                onClick={() => handleSave(row.id)}
                                disabled={isPending}
                                className="rounded bg-indigo-600 px-2 py-1 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                              >
                                {isPending ? "…" : "Save"}
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:text-white"
                              >
                                Cancel
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    // ── View row ──────────────────────────────────────────────
                    const hasCatalog = !!(row.rsCode || row.rsDescription);
                    return (
                      <tr
                        key={row.id}
                        className={`group hover:bg-slate-900/40 ${!hasCatalog ? "opacity-70" : ""}`}
                      >
                        <td className={`${td} font-medium text-white`}>
                          {row.ibsaProduct ? (
                            <>
                              {row.ibsaProduct.name}
                              {row.ibsaProduct.variant && (
                                <span className="ml-1 text-xs text-slate-400">
                                  ({row.ibsaProduct.variant})
                                </span>
                              )}
                              <div className="text-xs text-slate-500">
                                {row.ibsaProduct.code}
                              </div>
                            </>
                          ) : (
                            <span className="italic text-slate-500">
                              Unlinked
                            </span>
                          )}
                        </td>
                        <td className={`${td} font-mono text-slate-300`}>
                          {row.rsCode ?? (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className={`${td} text-slate-300`}>
                          <span className="line-clamp-2">
                            {row.rsDescription ?? (
                              <span className="text-slate-600">—</span>
                            )}
                          </span>
                        </td>
                        <td className={td}>
                          {row.rsVariant ? (
                            <span className="rounded bg-slate-700 px-1.5 py-0.5 text-xs">
                              {row.rsVariant}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className={`${td} text-right font-mono`}>
                          {row.cartonSize ?? (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className={`${td} text-right font-mono`}>
                          {row.cartonPrice != null ? (
                            `£${row.cartonPrice.toFixed(2)}`
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className={`${td} text-xs text-slate-400`}>
                          <span className="line-clamp-2">{row.notes ?? ""}</span>
                        </td>
                        <td className={`${td} text-right`}>
                          <div className="flex justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                              onClick={() => startEdit(row)}
                              className="rounded px-2 py-1 text-xs text-indigo-400 hover:text-indigo-300"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(row.id)}
                              className="rounded px-2 py-1 text-xs text-red-500 hover:text-red-400"
                            >
                              Del
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      {rsProducts.length === 0 && (
        <div className="rounded-xl border border-slate-800 p-12 text-center text-slate-500">
          No supplier rows yet. Click &ldquo;Add product&rdquo; to get started.
        </div>
      )}
    </div>
  );
}
