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
        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-500 hover:border-green-300 hover:text-green-600 transition-colors"
      >
        Mark complete
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white shadow-2xl p-6">
            <h2 className="text-base font-bold text-gray-900">Mark as complete?</h2>

            <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-sm font-medium text-gray-900">{conventionName}</p>
              <p className="mt-0.5 text-xs text-gray-500">
                {dept === "FA" ? "First Aid" : "Cleaning Supplies"} shipment
              </p>
            </div>

            {itemCount > 0 && (
              <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
                <input
                  type="checkbox"
                  checked={deductStock}
                  onChange={(e) => setDeductStock(e.target.checked)}
                  className="h-4 w-4 accent-red-500"
                />
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    Deduct {itemCount} product{itemCount !== 1 ? "s" : ""} from stock
                  </p>
                  <p className="text-xs text-gray-400">
                    Uncheck if stock was already counted after picking
                  </p>
                </div>
              </label>
            )}

            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                disabled={isPending}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={isPending}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
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
