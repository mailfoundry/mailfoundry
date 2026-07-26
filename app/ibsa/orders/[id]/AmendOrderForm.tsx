"use client";

import { useState, useRef } from "react";
import { amendOrder } from "./actions";

type Line = {
  id: string;
  dept: string;
  qty: number;
  product: { id: string; name: string; variant: string | null; code: string; unitCost: number };
};

type Product = {
  id: string;
  name: string;
  variant: string | null;
  code: string;
  dept: string; // "CS" | "FA"
};

type Props = {
  orderId: string;
  lines: Line[];
  availableProducts: Product[];
};

const fmtGbp = (n: number) =>
  n.toLocaleString("en-GB", { style: "currency", currency: "GBP" });

export default function AmendOrderForm({ orderId, lines, availableProducts }: Props) {
  const [qtys, setQtys] = useState<Record<string, number>>(
    Object.fromEntries(lines.map((l) => [l.id, l.qty]))
  );
  const [newLines, setNewLines] = useState<
    { uid: string; productId: string; dept: string; qty: number }[]
  >([]);
  const [addProductId, setAddProductId] = useState("");
  const [addQty, setAddQty] = useState(1);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const changed =
    lines.some((l) => qtys[l.id] !== l.qty) || newLines.length > 0;

  function handleAdd() {
    if (!addProductId || addQty < 1) return;
    const prod = availableProducts.find((p) => p.id === addProductId);
    if (!prod) return;
    setNewLines((prev) => [
      ...prev,
      { uid: crypto.randomUUID(), productId: prod.id, dept: prod.dept, qty: addQty },
    ]);
    setAddProductId("");
    setAddQty(1);
  }

  function removeNewLine(uid: string) {
    setNewLines((prev) => prev.filter((l) => l.uid !== uid));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(formRef.current!);
    await amendOrder(fd);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const grandTotal =
    lines.reduce((s, l) => s + (qtys[l.id] ?? 0) * l.product.unitCost, 0) +
    newLines.reduce((s, nl) => {
      const p = availableProducts.find((x) => x.id === nl.productId);
      return s + nl.qty * (p ? 0 : 0); // unitCost not available in Product type — show line count only
    }, 0);

  // Group lines by dept for display
  const csLines = lines.filter((l) => l.dept === "CS");
  const faLines = lines.filter((l) => l.dept === "FA");

  const renderSection = (label: string, sectionLines: Line[]) => {
    if (sectionLines.length === 0) return null;
    return (
      <div className="mb-4">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</p>
        <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white overflow-hidden">
          {sectionLines.map((l) => {
            const q = qtys[l.id] ?? l.qty;
            const removed = q === 0;
            return (
              <div
                key={l.id}
                className={`flex items-center gap-3 px-4 py-2.5 ${removed ? "opacity-40 bg-red-50" : ""}`}
              >
                <input type="hidden" name={`line_${l.id}`} value={q} readOnly />
                <span className="font-mono text-xs text-gray-400 w-14 shrink-0">{l.product.code}</span>
                <span className="flex-1 text-sm text-gray-900">
                  {l.product.name}
                  {l.product.variant && (
                    <span className="ml-1.5 text-xs text-gray-400">{l.product.variant}</span>
                  )}
                </span>
                <span className="text-xs text-gray-400 shrink-0">{fmtGbp(l.product.unitCost)}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setQtys((prev) => ({ ...prev, [l.id]: Math.max(0, (prev[l.id] ?? l.qty) - 1) }))}
                    className="h-7 w-7 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 text-sm font-bold flex items-center justify-center"
                  >−</button>
                  <input
                    type="number"
                    min={0}
                    value={q === 0 ? "" : q}
                    placeholder="0"
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      setQtys((prev) => ({ ...prev, [l.id]: isNaN(v) ? 0 : Math.max(0, v) }));
                    }}
                    className="h-7 w-12 border-x border-gray-300 text-center text-sm font-bold text-gray-900 placeholder:text-gray-400 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setQtys((prev) => ({ ...prev, [l.id]: (prev[l.id] ?? l.qty) + 1 }))}
                    className="h-7 w-7 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 text-sm font-bold flex items-center justify-center"
                  >+</button>
                </div>
                <button
                  type="button"
                  title="Remove line"
                  onClick={() => setQtys((prev) => ({ ...prev, [l.id]: 0 }))}
                  className={`shrink-0 text-xs px-2 py-1 rounded-md border transition-colors ${
                    removed
                      ? "border-orange-300 bg-orange-50 text-orange-600 hover:bg-orange-100"
                      : "border-red-200 text-red-400 hover:bg-red-50 hover:text-red-600"
                  }`}
                >
                  {removed ? "Undo" : "Remove"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Already-used product IDs (existing non-zero + new)
  const usedIds = new Set([
    ...lines.filter((l) => (qtys[l.id] ?? l.qty) > 0).map((l) => l.product.id + "_" + l.dept),
    ...newLines.map((nl) => nl.productId + "_" + nl.dept),
  ]);

  const selectableProducts = availableProducts.filter(
    (p) => !usedIds.has(p.id + "_" + p.dept)
  );

  return (
    <form ref={formRef} onSubmit={handleSubmit}>
      <input type="hidden" name="orderId" value={orderId} />

      {/* Existing lines */}
      {renderSection("Cleaning Supplies", csLines)}
      {renderSection("First Aid", faLines)}

      {/* New lines added this session */}
      {newLines.length > 0 && (
        <div className="mb-4">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">Adding</p>
          <div className="divide-y divide-gray-100 rounded-xl border border-green-200 bg-green-50 overflow-hidden">
            {newLines.map((nl) => {
              const prod = availableProducts.find((p) => p.id === nl.productId);
              return (
                <div key={nl.uid} className="flex items-center gap-3 px-4 py-2.5">
                  <input type="hidden" name={`new_${nl.productId}_${nl.dept}`} value={nl.qty} readOnly />
                  <span className="text-green-600 text-sm font-bold shrink-0">+</span>
                  <span className="flex-1 text-sm text-gray-900">
                    {prod?.name}
                    {prod?.variant && <span className="ml-1.5 text-xs text-gray-400">{prod.variant}</span>}
                    <span className="ml-1.5 text-xs text-gray-400 uppercase">{nl.dept}</span>
                  </span>
                  <span className="text-sm font-bold text-gray-700">× {nl.qty}</span>
                  <button
                    type="button"
                    onClick={() => removeNewLine(nl.uid)}
                    className="text-xs px-2 py-1 rounded-md border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                  >Remove</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add product row */}
      {selectableProducts.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <select
            value={addProductId}
            onChange={(e) => setAddProductId(e.target.value)}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-orange-500"
          >
            <option value="">Add a product…</option>
            <optgroup label="Cleaning Supplies">
              {selectableProducts.filter((p) => p.dept === "CS").map((p) => (
                <option key={p.id + "_CS"} value={p.id}>
                  {p.name}{p.variant ? ` (${p.variant})` : ""} — {p.code}
                </option>
              ))}
            </optgroup>
            <optgroup label="First Aid">
              {selectableProducts.filter((p) => p.dept === "FA").map((p) => (
                <option key={p.id + "_FA"} value={p.id}>
                  {p.name}{p.variant ? ` (${p.variant})` : ""} — {p.code}
                </option>
              ))}
            </optgroup>
          </select>
          <input
            type="number"
            min={1}
            value={addQty}
            onChange={(e) => setAddQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
            className="w-16 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-center font-bold text-gray-900 outline-none focus:border-orange-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!addProductId}
            className="rounded-lg bg-gray-100 border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Add
          </button>
        </div>
      )}

      {/* Save button */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!changed || saving}
          className="rounded-lg bg-orange-500 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Saving…" : "Save changes & notify customer"}
        </button>
        {saved && (
          <span className="text-sm text-green-600 font-medium">✓ Saved — emails sent</span>
        )}
        {!changed && !saved && (
          <span className="text-xs text-gray-400">No changes yet</span>
        )}
      </div>
    </form>
  );
}
