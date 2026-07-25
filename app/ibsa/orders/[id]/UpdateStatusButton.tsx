"use client";

import { useTransition } from "react";
import { updateOrderStatus } from "./actions";

const STATUSES = ["submitted", "processing", "complete", "cancelled"] as const;

const LABELS: Record<string, string> = {
  submitted:  "Submitted",
  processing: "Processing",
  complete:   "Complete",
  cancelled:  "Cancelled",
};

export default function UpdateStatusButton({ orderId, currentStatus }: { orderId: string; currentStatus: string }) {
  const [isPending, startTransition] = useTransition();

  function handleChange(status: string) {
    const fd = new FormData();
    fd.set("orderId", orderId);
    fd.set("status", status);
    startTransition(() => updateOrderStatus(fd));
  }

  return (
    <div className="flex flex-wrap gap-2">
      {STATUSES.map((s) => (
        <button
          key={s}
          type="button"
          disabled={isPending || s === currentStatus}
          onClick={() => handleChange(s)}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${
            s === currentStatus
              ? "bg-gray-900 text-white"
              : "border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-40"
          }`}
        >
          {LABELS[s]}
        </button>
      ))}
    </div>
  );
}
