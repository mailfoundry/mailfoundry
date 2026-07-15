"use client";

import { useState, useTransition } from "react";
import { updateConventionDate, updateDeliveryDate } from "./actions";

type Props = {
  label: string;
  field: "convention" | "delivery";
  conventionId: string;
  initialValue: string; // YYYY-MM-DD or ""
};

export default function DateCard({ label, field, conventionId, initialValue }: Props) {
  const [value, setValue] = useState(initialValue);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function save() {
    const fd = new FormData();
    fd.set("conventionId", conventionId);
    fd.set("date", value);
    const action = field === "convention" ? updateConventionDate : updateDeliveryDate;
    startTransition(async () => {
      await action(fd);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <p className="mb-2 text-xs text-slate-500">{label}</p>
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={value}
          onChange={(e) => { setValue(e.target.value); setSaved(false); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } }}
          className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white outline-none focus:border-orange-500"
        />
        <button
          onClick={save}
          disabled={isPending}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
            saved
              ? "bg-green-700 text-white"
              : "border border-slate-700 text-slate-300 hover:bg-slate-800"
          }`}
        >
          {isPending ? "…" : saved ? "✓" : "Save"}
        </button>
      </div>
    </div>
  );
}
