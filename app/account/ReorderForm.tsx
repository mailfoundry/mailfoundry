"use client";

import { useState } from "react";
import { reorder } from "./actions";
import AddressAutocomplete from "../order/AddressAutocomplete";

export default function ReorderForm({
  orderId,
  defaultAddress,
}: {
  orderId: string;
  defaultAddress: string;
}) {
  const [open, setOpen]             = useState(false);
  const [paymentMethod, setPayment] = useState<"bacs" | "card" | "po" | "">("");

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
          <AddressAutocomplete
            defaultValue={defaultAddress}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-orange-500 placeholder:text-gray-400"
          />
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs text-gray-500">Payment preference</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {([
            { value: "bacs", label: "BACS Transfer",       desc: "Pay by bank transfer" },
            { value: "card", label: "Credit / Debit Card", desc: "We'll send a Stripe link" },
            { value: "po",   label: "Purchase Order",      desc: "We'll invoice your organisation" },
          ] as const).map(({ value, label, desc }) => (
            <label key={value}
              className={`flex cursor-pointer flex-col gap-0.5 rounded-xl border p-3 transition-colors ${paymentMethod === value ? "border-orange-400 bg-orange-50" : "border-gray-200 hover:border-gray-300"}`}>
              <input type="radio" name="paymentMethod" value={value}
                checked={paymentMethod === value}
                onChange={() => setPayment(value)}
                className="sr-only" />
              <span className="text-xs font-semibold text-gray-900">{label}</span>
              <span className="text-[11px] text-gray-400">{desc}</span>
            </label>
          ))}
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
