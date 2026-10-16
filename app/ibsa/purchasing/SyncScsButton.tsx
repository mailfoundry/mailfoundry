"use client";

import { useState, useTransition } from "react";
import { syncScsNow } from "./scs-sync-actions";

export default function SyncScsButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ text: string; detail?: string[]; error?: boolean } | null>(null);

  const run = () =>
    start(async () => {
      const r = await syncScsNow();
      if (!r.ok) return setMsg({ text: `Sync failed: ${r.error}`, error: true });
      const { created, completed, cancelled, productsCreated, unmatched } = r.result;
      const parts = [
        `${created} new SCS order${created === 1 ? "" : "s"}`,
        `${completed} dispatched (stock deducted)`,
        cancelled ? `${cancelled} cancelled` : null,
        productsCreated.length ? `${productsCreated.length} Christeyns product${productsCreated.length === 1 ? "" : "s"} added` : null,
      ].filter(Boolean);
      setMsg({
        text: parts.join(" · "),
        detail: [
          ...productsCreated.map((p) => `Added: ${p}`),
          ...unmatched.map((u) => `Not linked: ${u}`),
        ],
      });
    });

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-sm text-gray-600">
        <span className="font-semibold text-gray-800">SCS web orders</span> sync automatically every 15 minutes and count as demand below.
      </div>
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="ml-auto rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-700 disabled:opacity-60"
      >
        {pending ? "Syncing…" : "Sync SCS orders now"}
      </button>
      {msg && (
        <div className={`w-full text-xs ${msg.error ? "text-red-600" : "text-green-700"}`}>
          {msg.text}
          {!!msg.detail?.length && (
            <ul className="mt-1 list-disc pl-5 text-gray-500">
              {msg.detail.map((d) => <li key={d}>{d}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
