"use client";

import { useState, useTransition } from "react";
import { updateGroupOrderStatus, deleteGroupOrder, deleteGroupOrderLine } from "./actions";
import ImportOrderModal from "./ImportOrderModal";

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
  submitted:  { label: "Submitted",  color: "text-blue-700 border-blue-200 bg-blue-100" },
  processing: { label: "Processing", color: "text-amber-700 border-amber-200 bg-amber-100" },
  complete:   { label: "Complete",   color: "text-green-700 border-green-200 bg-green-100" },
  cancelled:  { label: "Cancelled",  color: "text-gray-500 border-gray-200 bg-gray-100" },
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
  const [showImport, setShowImport] = useState(false);

  const active    = orders.filter((o) => o.status !== "complete" && o.status !== "cancelled");
  const completed = orders.filter((o) => o.status === "complete" || o.status === "cancelled");

  return (
    <div>
      {showImport && <ImportOrderModal onClose={() => setShowImport(false)} />}

      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Group Orders — Congregation / Circuit / Regional
          {active.length > 0 && (
            <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-blue-700">{active.length}</span>
          )}
        </p>
        <button
          onClick={() => setShowImport(true)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
        >
          Import from Spreadsheet
        </button>
      </div>

      {orders.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <p className="text-gray-400">No group orders yet.</p>
          <p className="mt-1 text-xs text-gray-300">
            Orders submitted via <span className="font-mono text-gray-400">/order</span> will appear here.
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
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
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

function GroupOrderLineRow({ line }: { line: GroupOrderLine }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [, startTransition] = useTransition();

  function handleDelete() {
    const fd = new FormData();
    fd.set("id", line.id);
    startTransition(() => deleteGroupOrderLine(fd));
  }

  return (
    <tr className="border-t border-gray-100 group">
      <td className="py-2 text-gray-900">
        {line.productName}
        {line.productVariant && (
          <span className="ml-2 text-xs text-gray-400">{line.productVariant}</span>
        )}
        <span className="ml-2 font-mono text-xs text-gray-300">{line.productCode}</span>
      </td>
      <td className="py-2 text-right font-semibold text-gray-900">{line.qty}</td>
      <td className="py-2 text-right text-gray-400">{fmtGbp(line.unitCost)}</td>
      <td className="py-2 text-right text-amber-600">{fmtGbp(line.qty * line.unitCost)}</td>
      <td className="py-2 pl-4 text-right">
        {confirmDelete ? (
          <span className="flex items-center justify-end gap-2">
            <button onClick={handleDelete} className="text-xs font-semibold text-red-500 hover:text-red-600">Remove</button>
            <button onClick={() => setConfirmDelete(false)} className="text-xs text-gray-400 hover:text-gray-700">Cancel</button>
          </span>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-xs text-gray-200 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity"
          >
            ✕
          </button>
        )}
      </td>
    </tr>
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
    <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-400">{GROUP_TYPE_LABELS[order.groupType] ?? order.groupType}</span>
            <span className="font-semibold text-gray-900">{order.groupName}</span>
            <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${st.color}`}>
              {st.label}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-400">
            <span>{order.contactName}</span>
            <span className="text-gray-200">·</span>
            <span>{order.contactEmail}</span>
            {order.contactMobile && (
              <>
                <span className="text-gray-200">·</span>
                <span>{order.contactMobile}</span>
              </>
            )}
            <span className="text-gray-200">·</span>
            <span>{fmtDate(order.submittedAt)}</span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
            {csLines.length > 0 && <span>CS: {csLines.length} product{csLines.length !== 1 ? "s" : ""}</span>}
            {faLines.length > 0 && <span>FA: {faLines.length} product{faLines.length !== 1 ? "s" : ""}</span>}
            {totalValue > 0 && <span className="text-amber-600 font-semibold">{fmtGbp(totalValue)}</span>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {order.status === "submitted" && (
            <button
              onClick={() => changeStatus("processing")}
              className="rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
            >
              Mark processing
            </button>
          )}
          {order.status === "processing" && (
            <button
              onClick={() => changeStatus("complete")}
              className="rounded border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100 transition-colors"
            >
              Mark complete
            </button>
          )}
          {(order.status === "submitted" || order.status === "processing") && (
            <button
              onClick={() => changeStatus("cancelled")}
              className="rounded border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-400 hover:text-red-500 hover:border-red-200 transition-colors"
            >
              Cancel
            </button>
          )}

          <button
            onClick={onToggle}
            className="rounded border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
          >
            {isOpen ? "Close" : "View"}
          </button>
        </div>
      </div>

      {/* Detail */}
      {isOpen && (
        <div className="bg-gray-50 p-5">
          {(["CS", "FA"] as const).map((dept) => {
            const lines = order.lines.filter((l) => l.dept === dept);
            if (lines.length === 0) return null;
            return (
              <div key={dept} className="mb-4 last:mb-0">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {dept === "CS" ? "Cleaning Supplies" : "First Aid"}
                </p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs text-gray-400">
                      <th className="pb-2 text-left font-semibold uppercase tracking-wider">Product</th>
                      <th className="pb-2 text-right font-semibold uppercase tracking-wider">Qty</th>
                      <th className="pb-2 text-right font-semibold uppercase tracking-wider">Unit</th>
                      <th className="pb-2 text-right font-semibold uppercase tracking-wider">Total</th>
                      <th className="pb-2 pl-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => (
                      <GroupOrderLineRow key={l.id} line={l} />
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}

          {/* Delete */}
          <div className="mt-4 border-t border-gray-100 pt-4">
            {confirmDelete ? (
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">Delete this order?</span>
                <button onClick={handleDelete} className="text-xs font-semibold text-red-500 hover:text-red-600">
                  Yes, delete
                </button>
                <button onClick={() => setConfirmDelete(false)} className="text-xs text-gray-400 hover:text-gray-700">
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-xs text-gray-300 hover:text-red-500 transition-colors"
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
