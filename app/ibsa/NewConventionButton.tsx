"use client";

import { useState, useTransition } from "react";
import { createConvention } from "./actions";

type Draft = {
  name: string;
  venue: string;
  conventionDate: string;
  deliveryDate: string;
  deliveryAddress: string;
  contactName: string;
  contactEmail: string;
  contactMobile: string;
  faEnabled: boolean;
};

const empty = (): Draft => ({
  name: "", venue: "", conventionDate: "", deliveryDate: "",
  deliveryAddress: "", contactName: "", contactEmail: "", contactMobile: "",
  faEnabled: false,
});

const EVENT_LABELS: Record<string, string> = {
  regional:     "Regional",
  circuit:      "Circuit Assembly",
  congregation: "Congregation",
};

export default function NewConventionButton({ eventType = "regional" }: { eventType?: string }) {
  const label = EVENT_LABELS[eventType] ?? "Event";
  const [open, setOpen]   = useState(false);
  const [draft, setDraft] = useState<Draft>(empty());
  const [isPending, startTransition] = useTransition();

  const set = (field: keyof Draft) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft((p) => ({ ...p, [field]: e.target.value }));

  function submit() {
    const fd = new FormData();
    Object.entries(draft).forEach(([k, v]) => fd.set(k, String(v)));
    fd.set("eventType", eventType);
    startTransition(async () => {
      await createConvention(fd);
      setOpen(false);
      setDraft(empty());
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 transition-colors"
      >
        + New {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-lg overflow-y-auto rounded-t-3xl border border-gray-200 bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-2xl">

            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-base font-bold text-gray-900">New {label}</h2>
              <button
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {/* Fields */}
            <div className="space-y-4 px-6 py-5">

              {/* Name */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-500">
                  Convention Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={draft.name}
                  onChange={set("name")}
                  placeholder="e.g. Manchester CS 2026"
                  autoFocus
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 placeholder:text-gray-300"
                />
              </div>

              {/* Venue */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-500">
                  Venue <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={draft.venue}
                  onChange={set("venue")}
                  placeholder="e.g. Manchester Central Convention Complex"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 placeholder:text-gray-300"
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-500">
                    Convention Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={draft.conventionDate}
                    onChange={set("conventionDate")}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-500">
                    Delivery Date <span className="font-normal text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="date"
                    value={draft.deliveryDate}
                    onChange={set("deliveryDate")}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Delivery address */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-500">
                  Delivery Address <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <textarea
                  value={draft.deliveryAddress}
                  onChange={set("deliveryAddress")}
                  rows={2}
                  placeholder="Full delivery address"
                  className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 placeholder:text-gray-300"
                />
              </div>

              {/* Contact */}
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <p className="mb-3 text-xs font-semibold text-gray-500">Contact Details <span className="font-normal text-gray-400">(optional)</span></p>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={draft.contactName}
                    onChange={set("contactName")}
                    placeholder="Contact name"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 placeholder:text-gray-300"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="email"
                      value={draft.contactEmail}
                      onChange={set("contactEmail")}
                      placeholder="Email"
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 placeholder:text-gray-300"
                    />
                    <input
                      type="tel"
                      value={draft.contactMobile}
                      onChange={set("contactMobile")}
                      placeholder="Mobile"
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 placeholder:text-gray-300"
                    />
                  </div>
                </div>
              </div>

              {/* FA toggle */}
              <div
                onClick={() => setDraft((p) => ({ ...p, faEnabled: !p.faEnabled }))}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                  draft.faEnabled
                    ? "border-blue-200 bg-blue-50"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <div
                  className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border transition-colors ${
                    draft.faEnabled
                      ? "border-blue-500 bg-blue-600"
                      : "border-gray-300 bg-white"
                  }`}
                >
                  {draft.faEnabled && (
                    <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3">
                      <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className={`text-sm font-semibold ${draft.faEnabled ? "text-blue-700" : "text-gray-700"}`}>
                    Include First Aid section
                  </p>
                  <p className="text-xs text-gray-400">Enables the blue FA order section on this convention card</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => setOpen(false)}
                disabled={isPending}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={isPending || !draft.name.trim() || !draft.conventionDate}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-40 transition-colors"
              >
                {isPending ? "Creating…" : `Create ${label}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
