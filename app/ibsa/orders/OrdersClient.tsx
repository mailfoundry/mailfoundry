"use client";

import { useState, useTransition } from "react";
import { bookInLine } from "./actions";

const fmtGbp = (n: number) =>
  n.toLocaleString("en-GB", { style: "currency", currency: "GBP" });

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

type BreakdownItem = { ibsaProductId: string; name: string; units: number };

export type OrderLine = {
  id: string;
  rsCode: string | null;
  description: string;
  variant: string | null;
  cartonSize: number | null;
  cartonsOrdered: number;
  cartonsReceived: number;
  pricePerCarton: number | null;
  totalCost: number | null;
  productBreakdown: BreakdownItem[];
};

export type PurchaseOrder = {
  id: string;
  poNumber: string;
  supplier: string;
  status: string;
  orderedAt: string;
  receivedAt: string | null;
  totalExVat: number;
  notes: string | null;
  lines: OrderLine[];
};

export default function OrdersClient({ orders, hideHeader }: { orders: PurchaseOrder[]; hideHeader?: boolean }) {
  const outstanding = orders.filter((o) => o.status !== "received" && o.status !== "cancelled");
  const received    = orders.filter((o) => o.status === "received");

  const [openId, setOpenId] = useState<string | null>(
    outstanding.length > 0 ? outstanding[0].id : null
  );

  const toggle = (id: string) => setOpenId((prev) => (prev === id ? null : id));

  return (
    <div className="max-w-5xl">
      {!hideHeader && (
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="mt-1 text-sm text-gray-500">
            Track purchase orders and book in deliveries line by line.
          </p>
        </div>
      )}

      {orders.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <p className="text-gray-400">No purchase orders yet.</p>
          <p className="mt-1 text-xs text-gray-300">
            Go to Purchasing → Supplier Order tab, then click &ldquo;✓ Mark as Ordered&rdquo; on a supplier.
          </p>
        </div>
      )}

      {outstanding.length > 0 && (
        <div className="mb-10">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Outstanding · {outstanding.length}
          </p>
          <div className="space-y-4">
            {outstanding.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                isOpen={openId === order.id}
                onToggle={() => toggle(order.id)}
              />
            ))}
          </div>
        </div>
      )}

      {received.length > 0 && (
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Received · {received.length}
          </p>
          <div className="space-y-3">
            {received.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                isOpen={openId === order.id}
                onToggle={() => toggle(order.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Order card ──────────────────────────────────────────────────────────────

function OrderCard({
  order,
  isOpen,
  onToggle,
}: {
  order: PurchaseOrder;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const isReceived = order.status === "received";
  const isPartial  = order.status === "partial";

  const receivedLines = order.lines.filter(
    (l) => l.cartonsReceived >= l.cartonsOrdered && l.cartonsOrdered > 0
  );

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-5 py-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold text-blue-600">{order.poNumber}</span>
            <span className="text-sm font-medium text-gray-900">{order.supplier}</span>
            {isReceived && (
              <span className="rounded border border-green-200 bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                ✓ Received
              </span>
            )}
            {isPartial && (
              <span className="rounded border border-amber-200 bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                Partial
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
            <span>Ordered {fmtDate(order.orderedAt)}</span>
            {isReceived && order.receivedAt && (
              <>
                <span className="text-gray-200">·</span>
                <span>Received {fmtDate(order.receivedAt)}</span>
              </>
            )}
            {!isReceived && (
              <>
                <span className="text-gray-200">·</span>
                <span>{receivedLines.length}/{order.lines.length} lines booked in</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {order.totalExVat > 0 && (
            <span className="text-sm font-semibold text-amber-600">{fmtGbp(order.totalExVat)}</span>
          )}
          <button
            onClick={onToggle}
            className={`rounded border px-3 py-1.5 text-xs font-semibold transition-colors ${
              isOpen
                ? "border-gray-300 bg-gray-100 text-gray-700 hover:bg-gray-200"
                : isReceived
                ? "border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
            }`}
          >
            {isOpen ? "Close" : isReceived ? "View" : "Book In"}
          </button>
        </div>
      </div>

      {isOpen && <BookInTable order={order} />}
    </div>
  );
}

// ── Book-in table ───────────────────────────────────────────────────────────

type PendingConfirm = {
  lineId: string;
  qty: number;
  description: string;
  variant: string | null;
  cartonSize: number | null;
  breakdown: BreakdownItem[];
  totalNeeded: number;
};

function BookInTable({ order }: { order: PurchaseOrder }) {
  const isReadOnly = order.status === "received";

  const [drafts, setDrafts] = useState<Map<string, string>>(() => {
    const m = new Map<string, string>();
    for (const l of order.lines) {
      m.set(l.id, String(l.cartonsReceived > 0 ? l.cartonsReceived : l.cartonsOrdered));
    }
    return m;
  });

  const [confirmed, setConfirmed] = useState<Set<string>>(() => {
    const s = new Set<string>();
    for (const l of order.lines) {
      if (l.cartonsReceived > 0) s.add(l.id);
    }
    return s;
  });

  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, startTransition] = useTransition();

  function requestConfirm(line: OrderLine) {
    const qty = parseInt(drafts.get(line.id) ?? "0", 10);
    if (isNaN(qty) || qty < 0) return;
    setPendingConfirm({
      lineId: line.id,
      qty,
      description: line.description,
      variant: line.variant,
      cartonSize: line.cartonSize,
      breakdown: line.productBreakdown,
      totalNeeded: line.productBreakdown.reduce((s, p) => s + p.units, 0),
    });
  }

  function submitConfirm() {
    if (!pendingConfirm) return;
    const { lineId, qty } = pendingConfirm;
    setIsSubmitting(true);
    const fd = new FormData();
    fd.set("lineId", lineId);
    fd.set("cartonsReceived", String(qty));
    startTransition(async () => {
      await bookInLine(fd);
      setConfirmed((prev) => new Set([...prev, lineId]));
      setPendingConfirm(null);
      setIsSubmitting(false);
    });
  }

  return (
    <>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-xs text-gray-500">
            <th className="px-5 py-2.5 text-left font-semibold uppercase tracking-wider">Code</th>
            <th className="px-5 py-2.5 text-left font-semibold uppercase tracking-wider">Description</th>
            <th className="px-5 py-2.5 text-left font-semibold uppercase tracking-wider">Var</th>
            <th className="px-5 py-2.5 text-right font-semibold uppercase tracking-wider">Carton</th>
            <th className="px-5 py-2.5 text-right font-semibold uppercase tracking-wider">Ordered</th>
            <th className="px-5 py-2.5 text-right font-semibold uppercase tracking-wider">Received</th>
            {!isReadOnly && <th className="px-5 py-2.5"></th>}
          </tr>
        </thead>
        <tbody className="bg-white">
          {order.lines.map((line) => {
            const isDone    = confirmed.has(line.id);
            const draft     = drafts.get(line.id) ?? String(line.cartonsOrdered);
            const draftNum  = parseInt(draft, 10);
            const isShort   = !isNaN(draftNum) && isDone && draftNum < line.cartonsOrdered;

            return (
              <tr
                key={line.id}
                className={`border-t border-gray-100 ${
                  isDone
                    ? isShort
                      ? "bg-amber-50"
                      : "bg-green-50"
                    : "hover:bg-gray-50"
                }`}
              >
                <td className="px-5 py-3 font-mono text-xs text-gray-400">
                  {line.rsCode ?? <span className="text-gray-200">—</span>}
                </td>
                <td className="px-5 py-3 text-gray-900">{line.description}</td>
                <td className="px-5 py-3">
                  {line.variant ? (
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">
                      {line.variant}
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-gray-400">
                  {line.cartonSize ?? <span className="text-gray-200">—</span>}
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-gray-700">
                  {line.cartonsOrdered}
                </td>
                <td className="px-5 py-3 text-right">
                  {isDone ? (
                    <span className={`tabular-nums font-semibold ${isShort ? "text-amber-600" : "text-green-600"}`}>
                      {draftNum}
                    </span>
                  ) : isReadOnly ? (
                    <span className="tabular-nums text-gray-700">{line.cartonsReceived}</span>
                  ) : (
                    <input
                      type="number"
                      min={0}
                      max={line.cartonsOrdered * 2}
                      value={draft}
                      onChange={(e) =>
                        setDrafts((prev) => new Map(prev).set(line.id, e.target.value))
                      }
                      className="w-16 rounded border border-gray-200 bg-white px-2 py-1 text-right text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                    />
                  )}
                </td>
                {!isReadOnly && (
                  <td className="px-5 py-3 text-right">
                    {isDone ? (
                      <span className="flex items-center justify-end gap-2">
                        <span className={isShort ? "text-amber-600" : "text-green-600"}>
                          {isShort ? "⚠ Short" : "✓"}
                        </span>
                        <button
                          onClick={() => setConfirmed((prev) => { const s = new Set(prev); s.delete(line.id); return s; })}
                          className="text-xs text-gray-400 hover:text-gray-700 underline"
                          title="Correct this entry"
                        >
                          edit
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => requestConfirm(line)}
                        className="rounded border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 transition-colors hover:bg-green-100"
                      >
                        Confirm
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {pendingConfirm && (
        <BookInConfirmModal
          pending={pendingConfirm}
          isSubmitting={isSubmitting}
          onCancel={() => setPendingConfirm(null)}
          onConfirm={submitConfirm}
        />
      )}
    </>
  );
}

// ── Book-in confirm modal ───────────────────────────────────────────────────

function BookInConfirmModal({
  pending,
  isSubmitting,
  onCancel,
  onConfirm,
}: {
  pending: PendingConfirm;
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { qty, description, variant, cartonSize, breakdown, totalNeeded } = pending;
  const receivedUnits = cartonSize ? qty * cartonSize : null;

  const stockLines: Array<{ name: string; units: number }> = [];
  if (receivedUnits && breakdown.length > 0) {
    let remaining = receivedUnits;
    for (let i = 0; i < breakdown.length; i++) {
      const p = breakdown[i];
      const share =
        i === breakdown.length - 1
          ? remaining
          : Math.floor((p.units / totalNeeded) * receivedUnits);
      remaining -= share;
      if (share > 0) stockLines.push({ name: p.name, units: share });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
        <h2 className="text-base font-bold text-gray-900">Confirm receipt</h2>

        <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
          <p className="text-sm font-medium text-gray-900">
            {description}
            {variant && <span className="ml-1.5 text-gray-500">· {variant}</span>}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">
            {qty} carton{qty !== 1 ? "s" : ""}
            {receivedUnits ? ` · ${receivedUnits} units` : ""}
          </p>
        </div>

        {stockLines.length > 0 ? (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-green-600">
              This will add to stock
            </p>
            <ul className="space-y-1">
              {stockLines.map((s) => (
                <li key={s.name} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{s.name}</span>
                  <span className="font-semibold text-green-600">+{s.units}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-4 text-xs text-gray-400">
            No product links found — stock won&apos;t be updated automatically.
          </p>
        )}

        <div className="mt-5 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isSubmitting}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50"
          >
            {isSubmitting ? "Saving…" : stockLines.length > 0 ? "Yes, add to stock" : "Confirm receipt"}
          </button>
        </div>
      </div>
    </div>
  );
}
