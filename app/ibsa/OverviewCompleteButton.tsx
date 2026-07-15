"use client";

import { useState, useTransition } from "react";
import { markCompleteAndDeductStock } from "./conventions/[id]/actions";

type Props = {
  conventionId: string;
  conventionName: string;
  dept: "CS" | "FA";
  itemCount: number;
};

export default function OverviewCompleteButton({
  conventionId,
  conventionName,
  dept,
  itemCount,
}: Props) {
  const [showModal, setShowModal] = useState(false);
  const [deductStock, setDeductStock] = useState(true);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    const fd = new FormData();
    fd.set("conventionId", conventionId);
    fd.set("dept", dept);
    fd.set("deductStock", String(deductStock));
    startTransition(async () => {
      await markCompleteAndDeductStock(fd);
      setShowModal(false);
    });
  }

  return (
    <>
      <button
        onClick={() => { setDeductStock(true); setShowModal(true); }}
        className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:border-green-700/60 hover:text-green-400 transition-colors"
      >
        Mark complete
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <h2 className="text-base font-bold text-white">Mark as complete?</h2>

            <div className="mt-3 rounded-lg border border-slate-800 bg-slate-800/60 px-4 py-3">
              <p className="text-sm font-medium text-white">{conventionName}</p>
              <p className="mt-0.5 text-xs text-slate-400">
                {dept === "FA" ? "First Aid" : "Cleaning Supplies"} shipment
              </p>
            </div>

            {itemCount > 0 && (
              <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-lg border border-slate-700 bg-slate-800/40 px-4 py-3">
                <input
                  type="checkbox"
                  checked={deductStock}
                  onChange={(e) => setDeductStock(e.target.checked)}
                  className="h-4 w-4 accent-red-500"
                />
                <div>
                  <p className="text-sm font-medium text-slate-200">
                    Deduct {itemCount} product{itemCount !== 1 ? "s" : ""} from stock
                  </p>
                  <p className="text-xs text-slate-500">
                    Uncheck if stock was already counted after picking
                  </p>
                </div>
              </label>
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
                className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600 disabled:opacity-50"
              >
                {isPending
                  ? "Saving…"
                  : deductStock && itemCount > 0
                  ? "Mark complete & deduct stock"
                  : "Mark complete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
