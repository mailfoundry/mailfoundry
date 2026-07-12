"use client";

import { useState, useTransition } from "react";
import { markCompleteAndDeductStock } from "./actions";

export type StockItem = {
  name: string;
  variant: string | null;
  qty: number;
};

type Props = {
  conventionId: string;
  conventionName: string;
  dept: "CS" | "FA";
  /** Items that will be deducted from stock — already filtered to this dept, qty > 0 */
  items: StockItem[];
  isActive: boolean;
};

export default function CompleteButton({
  conventionId,
  conventionName,
  dept,
  items,
  isActive,
}: Props) {
  const [showModal, setShowModal] = useState(false);
  const [isPending, startTransition] = useTransition();

  const activeClass =
    dept === "FA"
      ? "bg-green-700 text-white"
      : "bg-blue-600 text-white";

  const baseClass =
    "rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 px-3 py-2 text-sm font-semibold capitalize";

  if (isActive) {
    return (
      <button className={`rounded-lg px-3 py-2 text-sm font-semibold capitalize ${activeClass}`} disabled>
        complete
      </button>
    );
  }

  function handleConfirm() {
    const fd = new FormData();
    fd.set("conventionId", conventionId);
    fd.set("dept", dept);
    startTransition(async () => {
      await markCompleteAndDeductStock(fd);
      setShowModal(false);
    });
  }

  const totalUnits = items.reduce((s, i) => s + i.qty, 0);

  return (
    <>
      <button onClick={() => setShowModal(true)} className={baseClass}>
        complete
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <h2 className="text-base font-bold text-white">Mark {dept} as complete</h2>

            <div className="mt-3 rounded-lg border border-slate-800 bg-slate-800/60 px-4 py-3">
              <p className="text-sm font-medium text-white">{conventionName}</p>
              <p className="mt-0.5 text-xs text-slate-400">
                {dept === "FA" ? "First Aid" : "Cleaning Supplies"} shipment
              </p>
            </div>

            {items.length > 0 ? (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-red-400">
                  This will deduct from stock
                </p>
                <ul className="max-h-48 space-y-1 overflow-y-auto pr-1">
                  {items.map((item, i) => (
                    <li key={i} className="flex items-center justify-between text-sm">
                      <span className="text-slate-300">
                        {item.name}
                        {item.variant && (
                          <span className="ml-1 text-xs text-slate-500">({item.variant})</span>
                        )}
                      </span>
                      <span className="ml-4 shrink-0 font-semibold text-red-400">−{item.qty}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 border-t border-slate-800 pt-2 text-right text-xs text-slate-500">
                  {totalUnits} units total
                </p>
              </div>
            ) : (
              <p className="mt-4 text-xs text-slate-500">
                No items ordered for this shipment — no stock changes will be made.
              </p>
            )}

            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                disabled={isPending}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={isPending}
                className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
              >
                {isPending
                  ? "Saving…"
                  : items.length > 0
                  ? "Yes, mark complete & deduct stock"
                  : "Mark complete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
