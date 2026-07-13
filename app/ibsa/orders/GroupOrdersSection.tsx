"use client";

import { useState, useTransition } from "react";
import { updateGroupOrderStatus, deleteGroupOrder } from "./actions";

export type GroupOrderLine = {
  id: string;
  dept: string;
  qty: number;
  productName: string;
  productVariant: string | null;
  productCode: string;
  unitCost: number;
};

export type GroupOrder = {
  id: string;
  groupType: string;
  groupName: string;
  contactName: string;
  contactEmail: string;
  contactMobile: string | null;
  status: string;
  submittedAt: string;
  lines: GroupOrderLine[];
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  submitted:  { label: "Submitted",  color: "text-blue-400 border-blue-700/40 bg-blue-950/30" },
  processing: { label: "Processing", color: "text-amber-400 border-amber-700/40 bg-amber-950/30" },
  complete:   { label: "Complete",   color: "text-green-400 border-green-700/40 bg-green-950/30" },
  cancelled:  { label: "Cancelled",  color: "text-slate-500 border-slate-700/40 bg-slate-800/30" },
};

const GROUP_TYPE_LABELS: Record<string, string> = {
  congregation: "Congregation",
  circuit:      "Circuit Assembly",
  regional:     "Regional",
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

const fmtGbp = (n: number) =>
  n.toLocaleString("en-GB", { style: "currency", currency: "GBP" });

export default function GroupOrdersSection({ orders }: { orders: GroupOrder[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  const active    = orders.filter((o) => o.status !== "complete" && o.status !== "cancelled");
  const completed = orders.filter((o) => o.status === "complete" || o.status === "cancelled");

  return (
    <div>
      <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
        Group Orders — Congregation / Circuit / Regional
        {active.length > 0 && (
          <span className="ml-2 rounded-full bg-blue-900/50 px-2 py-0.5 text-blue-300">{active.length}</span>
        )}
      </p>

      {orders.length === 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center">
          <p className="text-slate-400">No group orders yet.</p>
          <p className="mt-1 text-xs text-slate-600">
            Orders submitted via <span className="font-mono text-slate-500">/order</span> will appear here.
          </p>
        </div>
      )}

      {active.length > 0 && (
        <div className="space-y-3">
          {active.map((order) => (
            <GroupOrderCard
              key={order.id}
              order={order}
              isOpen={openId === order.id}
              onToggle={() => setOpenId((prev) => (prev === order.id ? null : order.id))}
            />
          ))}
        </div>
      )}

      {completed.length > 0 && (
        <div className="mt-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-600">
            Completed / Cancelled · {completed.length}
          </p>
          <div className="space-y-2">
            {completed.map((order) => (
              <GroupOrderCard
                key={order.id}
                order={order}
                isOpen={openId === order.id}
                onToggle={() => setOpenId((prev) => (prev === order.id ? null : order.id))}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GroupOrderCard({
  order,
  isOpen,
  onToggle,
}: {
  order: GroupOrder;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const [, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const csLines = order.lines.filter((l) => l.dept === "CS");
  const faLines = order.lines.filter((l) => l.dept === "FA");
  const totalValue = order.lines.reduce((s, l) => s + l.qty * l.unitCost, 0);
  const st = STATUS_LABELS[order.status] ?? STATUS_LABELS.submitted;

  function changeStatus(status: string) {
    const fd = new FormData();
    fd.set("id", order.id);
    fd.set("status", status);
    startTransition(() => updateGroupOrderStatus(fd));
  }

  function handleDelete() {
    const fd = new FormData();
    fd.set("id", order.id);
    startTransition(() => deleteGroupOrder(fd));
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900 px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">{GROUP_TYPE_LABELS[order.groupType] ?? order.groupType}</span>
            <span className="font-semibold text-white">{order.groupName}</span>
            <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${st.color}`}>
              {st.label}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>{order.contactName}</span>
            <span className="text-slate-700">·</span>
            <span>{order.contactEmail}</span>
            {order.contactMobile && (
              <>
                <span className="text-slate-700">·</span>
                <span>{order.contactMobile}</span>
              </>
            )}
            <span className="text-slate-700">·</span>
            <span>{fmtDate(order.submittedAt)}</span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
            {csLines.length > 0 && <span>CS: {csLines.length} product{csLines.length !== 1 ? "s" : ""}</span>}
            {faLines.length > 0 && <span>FA: {faLines.length} product{faLines.length !== 1 ? "s" : ""}</span>}
            {totalValue > 0 && <span className="text-amber-400 font-semibold">{fmtGbp(totalValue)}</span>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status changer */}
          {order.status === "submitted" && (
            <button
              onClick={() => changeStatus("processing")}
              className="rounded border border-amber-700/60 bg-amber-950/40 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-900/50"
            >
              Mark processing
            </button>
          )}
          {order.status === "processing" && (
            <button
              onClick={() => changeStatus("complete")}
              className="rounded border border-green-700/60 bg-green-950/40 px-3 py-1.5 text-xs font-semibold text-green-300 hover:bg-green-900/50"
            >
              Mark complete
            </button>
          )}
          {(order.status === "submitted" || order.status === "processing") && (
            <button
              onClick={() => changeStatus("cancelled")}
              className="rounded border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-red-400 hover:border-red-700/40"
            >
              Cancel
            </button>
          )}

          <button
            onClick={onToggle}
            className="rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700"
          >
            {isOpen ? "Close" : "View"}
          </button>
        </div>
      </div>

      {/* Detail */}
      {isOpen && (
        <div className="bg-slate-950 p-5">
          {(["CS", "FA"] as const).map((dept) => {
            const lines = order.lines.filter((l) => l.dept === dept);
            if (lines.length === 0) return null;
            return (
              <div key={dept} className="mb-4 last:mb-0">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {dept === "CS" ? "Cleaning Supplies" : "First Aid"}
                </p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs text-slate-500">
                      <th className="pb-2 text-left font-semibold uppercase tracking-wider">Product</th>
                      <th className="pb-2 text-right font-semibold uppercase tracking-wider">Qty</th>
                      <th className="pb-2 text-right font-semibold uppercase tracking-wider">Unit</th>
                      <th className="pb-2 text-right font-semibold uppercase tracking-wider">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => (
                      <tr key={l.id} className="border-t border-slate-800/50">
                        <td className="py-2 text-white">
                          {l.productName}
                          {l.productVariant && (
                            <span className="ml-2 text-xs text-slate-500">{l.productVariant}</span>
                          )}
                          <span className="ml-2 font-mono text-xs text-slate-600">{l.productCode}</span>
                        </td>
                        <td className="py-2 text-right font-semibold text-white">{l.qty}</td>
                        <td className="py-2 text-right text-slate-400">{fmtGbp(l.unitCost)}</td>
                        <td className="py-2 text-right text-amber-400">{fmtGbp(l.qty * l.unitCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}

          {/* Delete */}
          <div className="mt-4 border-t border-slate-800 pt-4">
            {confirmDelete ? (
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">Delete this order?</span>
                <button onClick={handleDelete} className="text-xs font-semibold text-red-400 hover:text-red-300">
                  Yes, delete
                </button>
                <button onClick={() => setConfirmDelete(false)} className="text-xs text-slate-500 hover:text-slate-300">
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-xs text-slate-600 hover:text-red-400"
              >
                Delete order
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
