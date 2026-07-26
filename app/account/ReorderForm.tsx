"use client";

import { useState } from "react";
import { reorder } from "./actions";

export default function ReorderForm({
  orderId,
  defaultAddress,
}: {
  orderId: string;
  defaultAddress: string;
}) {
  const [open, setOpen]       = useState(false);
  const [address, setAddress] = useState(defaultAddress);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
      >
        Re-order
      </button>
    );
  }

  return (
    <form
      action={reorder.bind(null, orderId)}
      className="mt-4 space-y-3 border-t border-gray-100 pt-4"
    >
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Confirm re-order details</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-gray-500">Required by date</label>
          <input
            type="date"
            name="requiredByDate"
            min={new Date().toISOString().split("T")[0]}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-orange-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">Delivery address</label>
          <input
            type="text"
            name="deliveryAddress"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-orange-500"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rounded-lg bg-orange-500 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-600 transition-colors"
        >
          Confirm re-order
        </button>
      </div>
    </form>
  );
}
