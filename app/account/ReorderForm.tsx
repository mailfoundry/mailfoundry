"use client";

import { useState } from "react";
import { reorder } from "./actions";
import AddressAutocomplete from "../order/AddressAutocomplete";

function formatUKMobile(raw: string): string {
  const isIntl = raw.replace(/\s/g, "").startsWith("+") ||
    (raw.replace(/\D/g, "").startsWith("44") && !raw.replace(/\D/g, "").startsWith("0"));
  const digits = raw.replace(/\D/g, "");
  if (isIntl) {
    const nat = digits.startsWith("44") ? digits.slice(2) : digits;
    const d = nat.slice(0, 10);
    if (d.length <= 4) return "+44" + (d ? " " + d : "");
    if (d.length <= 7) return `+44 ${d.slice(0, 4)} ${d.slice(4)}`;
    return `+44 ${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  }
  const d = digits.slice(0, 11);
  if (d.length <= 5) return d;
  if (d.length <= 8) return `${d.slice(0, 5)} ${d.slice(5)}`;
  return `${d.slice(0, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
}

export default function ReorderForm({
  orderId,
  defaultAddress,
  defaultMobile,
}: {
  orderId: string;
  defaultAddress: string;
  defaultMobile: string;
}) {
  const [open, setOpen]             = useState(false);
  const [mobile, setMobile]         = useState(defaultMobile);
  const [paymentMethod, setPayment] = useState<"bacs" | "card" | "po" | "">("");
  const [requiredByDate, setDate]   = useState("");

  const canSubmit = requiredByDate && paymentMethod;

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
            value={requiredByDate}
            onChange={(e) => setDate(e.target.value)}
            min={new Date().toISOString().split("T")[0]}
            required
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
        <div>
          <label className="mb-1 block text-xs text-gray-500">Mobile</label>
          <input
            type="tel"
            name="contactMobile"
            value={mobile}
            onChange={(e) => setMobile(formatUKMobile(e.target.value))}
            placeholder="07700 123 456"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-orange-500 placeholder:text-gray-400"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs text-gray-500">Additional notes (optional)</label>
          <textarea
            name="notes"
            rows={2}
            placeholder="e.g. preferred delivery time, access instructions…"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-orange-500 placeholder:text-gray-400 resize-none"
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
      <div className="flex items-center justify-between gap-2">
        {!canSubmit && (
          <p className="text-xs text-gray-400">
            {!requiredByDate && !paymentMethod ? "Select a date and payment method to continue" :
             !requiredByDate ? "Select a required-by date to continue" :
             "Select a payment method to continue"}
          </p>
        )}
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-lg bg-orange-500 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Confirm re-order
          </button>
        </div>
      </div>
    </form>
  );
}
