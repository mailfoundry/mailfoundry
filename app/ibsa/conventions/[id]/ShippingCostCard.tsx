"use client";

import { useState, useTransition } from "react";
import { updateShippingCost } from "./actions";

export default function ShippingCostCard({
  conventionId,
  initialValue,
  field = "cs",
}: {
  conventionId: string;
  initialValue: number;
  field?: "cs" | "fa";
}) {
  const [value, setValue] = useState(initialValue > 0 ? String(initialValue) : "");
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function save() {
    const fd = new FormData();
    fd.set("conventionId", conventionId);
    fd.set("shippingCost", value || "0");
    fd.set("field", field);
    startTransition(async () => {
      await updateShippingCost(fd);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <p className="mb-2 text-xs text-slate-500">
        {field === "fa" ? "FA Shipping Cost" : "Shipping Cost"}
      </p>
      <div className="flex items-center gap-1">
        <span className="text-sm text-slate-400">£</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={value}
          placeholder="0.00"
          onChange={(e) => { setValue(e.target.value); setSaved(false); }}
          onBlur={save}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } }}
          className="w-full bg-transparent text-sm text-white outline-none"
          disabled={isPending}
        />
        {saved && <span className="text-xs text-green-400">✓</span>}
      </div>
    </div>
  );
}
