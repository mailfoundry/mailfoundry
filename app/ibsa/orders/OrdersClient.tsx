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
};

export type PurchaseOrder = {
  id: string;
  poNumber: string;
  supplier: string;
  status: string;        // ordered | partial | received | cancelled
  orderedAt: string;
  receivedAt: string | null;
  totalExVat: number;
  notes: string | null;
  lines: OrderLine[];
};

export default function OrdersClient({ orders }: { orders: PurchaseOrder[] }) {
  const outstanding = orders.filter((o) => o.status !== "received" && o.status !== "cancelled");
  const received    = orders.filter((o) => o.status === "received");

  const [openId, setOpenId] = useState<string | null>(
    outstanding.length > 0 ? outstanding[0].id : null
  );

  const toggle = (id: string) => setOpenId((prev) => (prev === id ? null : id));

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Orders</h1>
        <p className="mt-1 text-sm text-slate-400">
          Track purchase orders and book in deliveries line by line.
        </p>
      </div>

      {orders.length === 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-12 text-center">
          <p className="text-slate-400">No purchase orders yet.</p>
          <p className="mt-1 text-xs text-slate-600">
            Go to Purchasing → Supplier Order tab, then click &ldquo;✓ Mark as Ordered&rdquo; on a supplier.
          </p>
        </div>
      )}

      {/* Outstanding */}
      {outstanding.length > 0 && (
        <div className="mb-10">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
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

      {/* Received */}
      {received.length > 0 && (
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
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

  const receivedLines = order.lines.filter((l) => l.cartonsReceived >= l.cartonsOrdered && l.cartonsOrdered > 0);
  const totalLines    = order.lines.length;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800">
      {/* Header row */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-5 py-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold text-blue-400">{order.poNumber}</span>
            <span className="text-sm font-medium text-white">{order.supplier}</span>
            {isReceived && (
              <span className="rounded border border-green-700/40 bg-green-950/30 px-2 py-0.5 text-xs font-semibold text-green-400">
                ✓ Received
              </span>
            )}
            {isPartial && (
              <span className="rounded border border-amber-700/40 bg-amber-950/30 px-2 py-0.5 text-xs font-semibold text-amber-400">
                Partial
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
            <span>Ordered {fmtDate(order.orderedAt)}</span>
            {isReceived && order.receivedAt && (
              <>
                <span className="text-slate-700">·</span>
                <span>Received {fmtDate(order.receivedAt)}</span>
              </>
            )}
            {!isReceived && (
              <>
                <span className="text-slate-700">·</span>
                <span>{receivedLines.length}/{totalLines} lines received</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {order.totalExVat > 0 && (
            <span className="text-sm font-semibold text-amber-400">
              {fmtGbp(order.totalExVat)}
            </span>
          )}
          <button
            onClick={onToggle}
            className={`rounded border px-3 py-1.5 text-xs font-semibold transition-colors ${
              isOpen
                ? "border-slate-600 bg-slate-700 text-slate-200 hover:bg-slate-600"
                : isReceived
                ? "border-slate-700 bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-white"
                : "border-blue-700/60 bg-blue-950/40 text-blue-300 hover:bg-blue-900/50 hover:text-blue-200"
            }`}
          >
            {isOpen ? "Close" : isReceived ? "View" : "Book In"}
          </button>
        </div>
      </div>

      {/* Expanded book-in table */}
      {isOpen && <BookInTable order={order} />}
    </div>
  );
}

// ── Book-in table ───────────────────────────────────────────────────────────

function BookInTable({ order }: { order: PurchaseOrder }) {
  const isReceived = order.status === "received";

  // Draft values: lineId → string (what's in the input box)
  const [drafts, setDrafts] = useState<Map<string, string>>(() => {
    const m = new Map<string, string>();
    for (const l of order.lines) {
      // Pre-fill with existing received qty, or full ordered qty if not yet touched
      m.set(l.id, String(l.cartonsReceived > 0 ? l.cartonsReceived : l.cartonsOrdered));
    }
    return m;
  });

  // Which lines have been confirmed this session (or already received when loaded)
  const [confirmed, setConfirmed] = useState<Set<string>>(() => {
    const s = new Set<string>();
    for (const l of order.lines) {
      if (l.cartonsReceived > 0) s.add(l.id);
    }
    return s;
  });

  const [pendingLine, setPendingLine] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleConfirm(lineId: string) {
    const qty = parseInt(drafts.get(lineId) ?? "0", 10);
    if (isNaN(qty) || qty < 0) return;
    setPendingLine(lineId);
    const fd = new FormData();
    fd.set("lineId", lineId);
    fd.set("cartonsReceived", String(qty));
    startTransition(async () => {
      await bookInLine(fd);
      setConfirmed((prev) => new Set([...prev, lineId]));
      setPendingLine(null);
    });
  }

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-800 bg-slate-800/50 text-xs text-slate-500">
            <th className="px-5 py-2.5 text-left font-semibold uppercase tracking-wider">Code</th>
            <th className="px-5 py-2.5 text-left font-semibold uppercase tracking-wider">Description</th>
            <th className="px-5 py-2.5 text-left font-semibold uppercase tracking-wider">Var</th>
            <th className="px-5 py-2.5 text-right font-semibold uppercase tracking-wider">Carton</th>
            <th className="px-5 py-2.5 text-right font-semibold uppercase tracking-wider">Ordered</th>
            <th className="px-5 py-2.5 text-right font-semibold uppercase tracking-wider">Received</th>
            {!isReceived && <th className="px-5 py-2.5"></th>}
          </tr>
        </thead>
        <tbody className="bg-slate-900">
          {order.lines.map((line) => {
            const isDone     = confirmed.has(line.id);
            const isPending  = pendingLine === line.id;
            const draft      = drafts.get(line.id) ?? String(line.cartonsOrdered);
            const draftNum   = parseInt(draft, 10);
            const isShort    = !isNaN(draftNum) && isDone && draftNum < line.cartonsOrdered;

            return (
              <tr
                key={line.id}
                className={`border-t border-slate-800 ${
                  isDone
                    ? isShort
                      ? "bg-amber-950/10"
                      : "bg-green-950/10"
                    : "hover:bg-slate-800/30"
                }`}
              >
                <td className="px-5 py-3 font-mono text-xs text-slate-400">
                  {line.rsCode ?? <span className="text-slate-700">—</span>}
                </td>
                <td className="px-5 py-3 text-white">{line.description}</td>
                <td className="px-5 py-3">
                  {line.variant ? (
                    <span className="rounded bg-slate-700 px-1.5 py-0.5 text-xs font-medium text-slate-300">
                      {line.variant}
                    </span>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-slate-400">
                  {line.cartonSize ?? <span className="text-slate-600">—</span>}
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-slate-300">
                  {line.cartonsOrdered}
                </td>
                <td className="px-5 py-3 text-right">
                  {isDone ? (
                    <span
                      className={`tabular-nums font-semibold ${
                        isShort ? "text-amber-400" : "text-green-400"
                      }`}
                    >
                      {draftNum}
                    </span>
                  ) : isReceived ? (
                    <span className="tabular-nums text-slate-300">{line.cartonsReceived}</span>
                  ) : (
                    <input
                      type="number"
                      min={0}
                      max={line.cartonsOrdered * 2}
                      value={draft}
                      onChange={(e) =>
                        setDrafts((prev) => new Map(prev).set(line.id, e.target.value))
                      }
                      className="w-16 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-right text-sm text-white focus:border-blue-500 focus:outline-none"
                    />
                  )}
                </td>
                {!isReceived && (
                  <td className="px-5 py-3 text-right">
                    {isDone ? (
                      <span className={isShort ? "text-amber-400" : "text-green-400"}>
                        {isShort ? "⚠" : "✓"}
                      </span>
                    ) : (
                      <button
                        onClick={() => handleConfirm(line.id)}
                        disabled={isPending}
                        className="rounded border border-green-700/60 bg-green-950/40 px-3 py-1 text-xs font-semibold text-green-400 transition-colors hover:bg-green-900/50 hover:text-green-300 disabled:opacity-50"
                      >
                        {isPending ? "…" : "Confirm"}
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Footer note */}
      {!isReceived && (
        <div className="border-t border-slate-800 bg-slate-900/50 px-5 py-3">
          <p className="text-xs text-slate-500">
            Adjust quantities if the delivery is short, then click Confirm per line.
            After booking in, update your stock levels on the{" "}
            <a href="/ibsa/products" className="text-blue-400 hover:text-blue-300 underline">
              Products page
            </a>.
          </p>
        </div>
      )}
    </div>
  );
}
