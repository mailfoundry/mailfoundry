"use client";

import { useState, useTransition } from "react";
import { markPoReceived, cancelPo } from "./actions";

type PoLine = {
  id: string;
  rsCode: string | null;
  description: string;
  variant: string | null;
  cartonSize: number | null;
  cartonsOrdered: number;
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

const STATUS_LABEL: Record<string, string> = {
  ordered:   "Ordered",
  partial:   "Partial",
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

const fmtGbp = (n: number) =>
  `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function PoRow({ po }: { po: Po }) {
  const [expanded, setExpanded]   = useState(false);
  const [pending,  startTransition] = useTransition();
  const [confirming, setConfirming] = useState<"receive" | "cancel" | null>(null);

  const isOpen = po.status === "ordered" || po.status === "partial";

  function handleReceive() {
    startTransition(async () => {
      await markPoReceived(po.id);
      setConfirming(null);
    });
  }

  function handleCancel() {
    startTransition(async () => {
      await cancelPo(po.id);
      setConfirming(null);
    });
  }

  return (
    <div className={`rounded-xl border bg-white overflow-hidden transition-opacity ${pending ? "opacity-60 pointer-events-none" : ""} ${po.status === "cancelled" ? "border-gray-100" : "border-gray-200"}`}>

      {/* ── Header row ── */}
      <button
        onClick={() => setExpanded((v) => !v)}
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
          <p className="text-sm font-semibold text-gray-900">{fmtGbp(po.totalExVat)} <span className="text-xs font-normal text-gray-400">ex VAT</span></p>
        </div>
        <span className={`shrink-0 text-gray-400 transition-transform ${expanded ? "rotate-90" : ""}`}>›</span>
      </button>

      {/* ── Expanded detail ── */}
      {expanded && (
        <div className="border-t border-gray-100 px-5 pb-5 pt-4">

          {/* Lines table */}
          <table className="w-full text-xs mb-4">
            <thead>
              <tr className="text-gray-400 uppercase tracking-wider text-[10px]">
                <th className="text-left pb-2 font-semibold">Description</th>
                <th className="text-left pb-2 font-semibold">Code</th>
                <th className="text-right pb-2 font-semibold">Cartons</th>
                <th className="text-right pb-2 font-semibold">Carton size</th>
                <th className="text-right pb-2 font-semibold">Unit price</th>
                <th className="text-right pb-2 font-semibold">Line total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {po.lines.map((l) => (
                <tr key={l.id} className="text-gray-700">
                  <td className="py-2 pr-4">
                    <span className="font-medium">{l.description}</span>
                    {l.variant && <span className="ml-1 text-gray-400">({l.variant})</span>}
                  </td>
                  <td className="py-2 pr-4 font-mono text-gray-400">{l.rsCode ?? "—"}</td>
                  <td className="py-2 pr-4 text-right">{l.cartonsOrdered}</td>
                  <td className="py-2 pr-4 text-right">{l.cartonSize ?? "—"}</td>
                  <td className="py-2 pr-4 text-right">{l.pricePerCarton != null ? fmtGbp(l.pricePerCarton) : "—"}</td>
                  <td className="py-2 text-right font-semibold">{l.totalCost != null ? fmtGbp(l.totalCost) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Notes */}
          {po.notes && (
            <p className="text-xs text-gray-500 mb-4 italic">{po.notes}</p>
          )}

          {/* Actions */}
          {isOpen && (
            <div className="flex items-center gap-3">
              {confirming === "receive" ? (
                <>
                  <span className="text-xs text-gray-600">Mark all stock as received and update inventory?</span>
                  <button onClick={handleReceive} className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-800 transition-colors">
                    Yes, mark received
                  </button>
                  <button onClick={() => setConfirming(null)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                </>
              ) : confirming === "cancel" ? (
                <>
                  <span className="text-xs text-gray-600">Cancel this PO? GIT stock will be reversed.</span>
                  <button onClick={handleCancel} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors">
                    Yes, cancel PO
                  </button>
                  <button onClick={() => setConfirming(null)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                    Keep
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setConfirming("receive")}
                    className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-800 transition-colors"
                  >
                    ✓ Mark as received
                  </button>
                  <button
                    onClick={() => setConfirming("cancel")}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
                  >
                    Cancel PO
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type Props = {
  open: Po[];
  closed: Po[];
};

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
          <p className="text-xs text-gray-400 mt-1">Raise orders from the <a href="/ibsa/purchasing" className="underline hover:text-gray-600">Purchasing</a> page.</p>
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
