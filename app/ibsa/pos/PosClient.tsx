"use client";

import { useState, useTransition } from "react";
import { updatePoLines, receivePoLines, cancelPo } from "./actions";
import type { LineEdit, LineReceipt } from "./actions";

export type PoLine = {
  id: string;
  rsCode: string | null;
  description: string;
  variant: string | null;
  cartonSize: number | null;
  cartonsOrdered: number;
  cartonsReceived: number;
  pricePerCarton: number | null;
  totalCost: number | null;
};

export type Po = {
  id: string;
  poNumber: string;
  supplier: string;
  status: string;
  orderedAt: string;
  receivedAt: string | null;
  totalExVat: number;
  notes: string | null;
  lines: PoLine[];
};

// ─── helpers ────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  ordered:   "Ordered",
  partial:   "Partially received",
  received:  "Received",
  cancelled: "Cancelled",
};
const STATUS_COLOUR: Record<string, string> = {
  ordered:   "bg-blue-50 text-blue-700 border-blue-200",
  partial:   "bg-amber-50 text-amber-700 border-amber-200",
  received:  "bg-green-50 text-green-700 border-green-200",
  cancelled: "bg-gray-100 text-gray-400 border-gray-200",
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

const fmtGbp = (n: number | null) =>
  n == null ? "—" : `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ─── PoRow ──────────────────────────────────────────────────────────────────

type Mode = "view" | "edit" | "receive" | "cancel";

function PoRow({ po }: { po: Po }) {
  const [expanded, setExpanded]     = useState(false);
  const [mode, setMode]             = useState<Mode>("view");
  const [pending, startTransition]  = useTransition();

  // Edit state: mirror of line quantities/prices
  const [editLines, setEditLines] = useState<LineEdit[]>(
    po.lines.map((l) => ({
      id: l.id,
      cartonsOrdered: l.cartonsOrdered,
      pricePerCarton: l.pricePerCarton,
      totalCost: l.totalCost,
    }))
  );

  // Receive state: how many cartons arriving NOW per line
  const [receiveQtys, setReceiveQtys] = useState<Record<string, number>>(
    Object.fromEntries(po.lines.map((l) => [l.id, Math.max(0, l.cartonsOrdered - l.cartonsReceived)]))
  );

  const isOpen = po.status === "ordered" || po.status === "partial";

  // Auto-recalculate totalCost when cartonsOrdered or pricePerCarton changes
  function setEditLine(id: string, patch: Partial<Omit<LineEdit, "id">>) {
    setEditLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const updated = { ...l, ...patch };
        // Recalculate totalCost if we have both fields
        if (updated.cartonsOrdered != null && updated.pricePerCarton != null) {
          updated.totalCost = parseFloat((updated.cartonsOrdered * updated.pricePerCarton).toFixed(2));
        }
        return updated;
      })
    );
  }

  function handleSaveEdit() {
    startTransition(async () => {
      await updatePoLines(po.id, editLines);
      setMode("view");
    });
  }

  function handleReceive() {
    const receipts: LineReceipt[] = po.lines
      .map((l) => ({ lineId: l.id, cartonsReceiving: receiveQtys[l.id] ?? 0 }))
      .filter((r) => r.cartonsReceiving > 0);
    if (receipts.length === 0) return;
    startTransition(async () => {
      await receivePoLines(po.id, receipts);
      setMode("view");
    });
  }

  function handleCancel() {
    startTransition(async () => {
      await cancelPo(po.id);
      setMode("view");
    });
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className={`rounded-xl border bg-white overflow-hidden transition-opacity ${
      pending ? "opacity-60 pointer-events-none" : ""
    } ${po.status === "cancelled" ? "border-gray-100" : "border-gray-200"}`}>

      {/* Header */}
      <button
        onClick={() => { setExpanded((v) => !v); if (!expanded) setMode("view"); }}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-sm font-bold text-gray-900">{po.poNumber}</span>
            <span className="text-sm font-medium text-gray-700">{po.supplier}</span>
            <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${STATUS_COLOUR[po.status] ?? "bg-gray-50 text-gray-500 border-gray-200"}`}>
              {STATUS_LABEL[po.status] ?? po.status}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-4 text-xs text-gray-400">
            <span>Raised {fmtDate(po.orderedAt)}</span>
            {po.receivedAt && <span>Received {fmtDate(po.receivedAt)}</span>}
            <span>{po.lines.length} {po.lines.length === 1 ? "line" : "lines"}</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold text-gray-900">
            {fmtGbp(po.totalExVat)} <span className="text-xs font-normal text-gray-400">ex VAT</span>
          </p>
        </div>
        <span className={`shrink-0 text-gray-400 transition-transform duration-150 ${expanded ? "rotate-90" : ""}`}>›</span>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-gray-100 px-5 pb-5 pt-4">

          {/* ── VIEW mode ────────────────────────────────────────────── */}
          {mode === "view" && (
            <>
              <table className="w-full text-xs mb-4">
                <thead>
                  <tr className="text-gray-400 uppercase tracking-wider text-[10px]">
                    <th className="text-left pb-2 font-semibold">Description</th>
                    <th className="text-left pb-2 font-semibold">Code</th>
                    <th className="text-right pb-2 font-semibold">Ordered</th>
                    <th className="text-right pb-2 font-semibold">Received</th>
                    <th className="text-right pb-2 font-semibold">Outstanding</th>
                    <th className="text-right pb-2 font-semibold">Unit price</th>
                    <th className="text-right pb-2 font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {po.lines.map((l) => {
                    const outstanding = l.cartonsOrdered - l.cartonsReceived;
                    return (
                      <tr key={l.id} className="text-gray-700">
                        <td className="py-2 pr-3">
                          <span className="font-medium">{l.description}</span>
                          {l.variant && <span className="ml-1 text-gray-400">({l.variant})</span>}
                          {l.cartonSize && <span className="ml-1 text-gray-300">· {l.cartonSize}/ctn</span>}
                        </td>
                        <td className="py-2 pr-3 font-mono text-gray-400">{l.rsCode ?? "—"}</td>
                        <td className="py-2 pr-3 text-right">{l.cartonsOrdered}</td>
                        <td className={`py-2 pr-3 text-right font-semibold ${l.cartonsReceived > 0 ? "text-green-700" : "text-gray-300"}`}>
                          {l.cartonsReceived}
                        </td>
                        <td className={`py-2 pr-3 text-right ${outstanding > 0 ? "text-amber-600 font-semibold" : "text-gray-300"}`}>
                          {outstanding > 0 ? outstanding : "—"}
                        </td>
                        <td className="py-2 pr-3 text-right">{fmtGbp(l.pricePerCarton)}</td>
                        <td className="py-2 text-right font-semibold">{fmtGbp(l.totalCost)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {po.notes && <p className="text-xs text-gray-500 mb-4 italic">{po.notes}</p>}

              {isOpen && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={() => setMode("receive")}
                    className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-800 transition-colors">
                    ✓ Book in delivery
                  </button>
                  <button onClick={() => { setMode("edit"); setEditLines(po.lines.map((l) => ({ id: l.id, cartonsOrdered: l.cartonsOrdered, pricePerCarton: l.pricePerCarton, totalCost: l.totalCost }))); }}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                    ✎ Edit PO
                  </button>
                  <button onClick={() => setMode("cancel")}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-400 hover:bg-gray-50 transition-colors">
                    Cancel PO
                  </button>
                </div>
              )}
            </>
          )}

          {/* ── EDIT mode ────────────────────────────────────────────── */}
          {mode === "edit" && (
            <>
              <p className="text-xs text-gray-500 mb-3">Correct quantities or prices — GIT will be adjusted automatically.</p>
              <table className="w-full text-xs mb-4">
                <thead>
                  <tr className="text-gray-400 uppercase tracking-wider text-[10px]">
                    <th className="text-left pb-2 font-semibold">Description</th>
                    <th className="text-right pb-2 font-semibold w-24">Qty ordered</th>
                    <th className="text-right pb-2 font-semibold w-28">Price / ctn</th>
                    <th className="text-right pb-2 font-semibold w-28">Line total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {editLines.map((el) => {
                    const orig = po.lines.find((l) => l.id === el.id)!;
                    return (
                      <tr key={el.id} className="text-gray-700">
                        <td className="py-2 pr-3">
                          <span className="font-medium">{orig.description}</span>
                          {orig.variant && <span className="ml-1 text-gray-400">({orig.variant})</span>}
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="number" min={orig.cartonsReceived} step={1}
                            value={el.cartonsOrdered}
                            onChange={(e) => setEditLine(el.id, { cartonsOrdered: parseInt(e.target.value) || 0 })}
                            className="w-full rounded border border-gray-200 px-2 py-1 text-right text-xs focus:border-blue-400 focus:outline-none"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="number" min={0} step={0.01}
                            value={el.pricePerCarton ?? ""}
                            placeholder="—"
                            onChange={(e) => setEditLine(el.id, { pricePerCarton: e.target.value ? parseFloat(e.target.value) : null })}
                            className="w-full rounded border border-gray-200 px-2 py-1 text-right text-xs focus:border-blue-400 focus:outline-none"
                          />
                        </td>
                        <td className="py-2 text-right text-gray-500">
                          {el.totalCost != null ? fmtGbp(el.totalCost) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} className="pt-3 text-right text-xs text-gray-400 font-semibold uppercase tracking-wider">New total</td>
                    <td className="pt-3 text-right text-xs font-bold text-gray-900">
                      {fmtGbp(editLines.reduce((s, l) => s + (l.totalCost ?? 0), 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
              <div className="flex gap-2">
                <button onClick={handleSaveEdit}
                  className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-700 transition-colors">
                  Save changes
                </button>
                <button onClick={() => setMode("view")}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                  Discard
                </button>
              </div>
            </>
          )}

          {/* ── RECEIVE mode ─────────────────────────────────────────── */}
          {mode === "receive" && (
            <>
              <p className="text-xs text-gray-500 mb-3">
                Enter how many cartons are arriving in <strong>this delivery</strong>. Leave a line at 0 if it&apos;s on backorder — the PO stays open and you can book it in later.
              </p>
              <table className="w-full text-xs mb-4">
                <thead>
                  <tr className="text-gray-400 uppercase tracking-wider text-[10px]">
                    <th className="text-left pb-2 font-semibold">Description</th>
                    <th className="text-right pb-2 font-semibold w-24">Ordered</th>
                    <th className="text-right pb-2 font-semibold w-24">Already rec&apos;d</th>
                    <th className="text-right pb-2 font-semibold w-24">Remaining</th>
                    <th className="text-right pb-2 font-semibold w-32">Arriving now</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {po.lines.map((l) => {
                    const remaining = l.cartonsOrdered - l.cartonsReceived;
                    const val = receiveQtys[l.id] ?? 0;
                    const fullyDone = remaining <= 0;
                    return (
                      <tr key={l.id} className={`text-gray-700 ${fullyDone ? "opacity-40" : ""}`}>
                        <td className="py-2 pr-3">
                          <span className="font-medium">{l.description}</span>
                          {l.variant && <span className="ml-1 text-gray-400">({l.variant})</span>}
                          {l.cartonSize && <span className="ml-1 text-gray-300">· {l.cartonSize}/ctn</span>}
                        </td>
                        <td className="py-2 pr-3 text-right">{l.cartonsOrdered}</td>
                        <td className="py-2 pr-3 text-right text-green-700 font-semibold">{l.cartonsReceived || "—"}</td>
                        <td className={`py-2 pr-3 text-right font-semibold ${remaining > 0 ? "text-amber-600" : "text-gray-300"}`}>
                          {remaining > 0 ? remaining : "✓"}
                        </td>
                        <td className="py-2">
                          <input
                            type="number" min={0} max={remaining} step={1}
                            value={fullyDone ? "" : val}
                            disabled={fullyDone}
                            onChange={(e) =>
                              setReceiveQtys((prev) => ({
                                ...prev,
                                [l.id]: Math.min(remaining, Math.max(0, parseInt(e.target.value) || 0)),
                              }))
                            }
                            className="w-full rounded border border-gray-200 px-2 py-1 text-right text-xs focus:border-green-500 focus:outline-none disabled:bg-gray-50 disabled:text-gray-300"
                            placeholder={fullyDone ? "✓ done" : "0"}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={handleReceive}
                  disabled={Object.values(receiveQtys).every((v) => v === 0)}
                  className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  ✓ Confirm delivery
                </button>
                <button onClick={() => setMode("view")}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
              </div>
              <p className="mt-2 text-[10px] text-gray-400">
                If only some lines arrive, the PO status will change to <strong>Partially received</strong> and remain open for the remainder.
              </p>
            </>
          )}

          {/* ── CANCEL confirm ───────────────────────────────────────── */}
          {mode === "cancel" && (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs text-gray-600">Cancel this PO? Any outstanding GIT stock will be reversed.</span>
              <button onClick={handleCancel}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors">
                Yes, cancel PO
              </button>
              <button onClick={() => setMode("view")}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                Keep
              </button>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

// ─── Page component ──────────────────────────────────────────────────────────

type Props = { open: Po[]; closed: Po[] };

export default function PosClient({ open, closed }: Props) {
  const [showClosed, setShowClosed] = useState(false);

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
          <p className="text-sm text-gray-500 mt-1">
            {open.length} open {open.length === 1 ? "order" : "orders"}
            {closed.length > 0 && ` · ${closed.length} completed/cancelled`}
          </p>
        </div>
      </div>

      {open.length === 0 && (
        <div className="rounded-xl border border-gray-100 bg-gray-50 px-6 py-10 text-center">
          <p className="text-sm text-gray-500">No open purchase orders.</p>
          <p className="text-xs text-gray-400 mt-1">
            Raise orders from the <a href="/ibsa/purchasing" className="underline hover:text-gray-600">Purchasing</a> page.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {open.map((po) => <PoRow key={po.id} po={po} />)}
      </div>

      {closed.length > 0 && (
        <div className="mt-8">
          <button
            onClick={() => setShowClosed((v) => !v)}
            className="text-xs font-semibold text-gray-400 hover:text-gray-600 uppercase tracking-wider transition-colors"
          >
            {showClosed ? "▾" : "▸"} {showClosed ? "Hide" : "Show"} completed & cancelled ({closed.length})
          </button>
          {showClosed && (
            <div className="mt-3 space-y-3">
              {closed.map((po) => <PoRow key={po.id} po={po} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
