"use client";

import { useState, useTransition } from "react";
import { submitGroupOrder } from "./actions";

type Product = {
  id: string;
  name: string;
  variant: string | null;
  code: string;
  category: string;
  unitCost: number;
};

const CATEGORY_LABELS: Record<string, string> = {
  safety_ppe: "Safety & PPE",
  janitorial:  "Janitorial",
  chemicals:   "Cleaning Chemicals",
  special:     "Special Order",
  firstaid:    "First Aid",
};

const GROUP_TYPES = [
  { value: "congregation",  label: "Congregation" },
  { value: "circuit",       label: "Circuit Assembly" },
  { value: "regional",      label: "Regional" },
];

export default function OrderFormClient({
  csProducts,
  faProducts,
  error,
}: {
  csProducts: Product[];
  faProducts: Product[];
  error?: string;
}) {
  const [activeTab, setActiveTab] = useState<"CS" | "FA">("CS");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [isPending, startTransition] = useTransition();

  // Group identity
  const [groupType, setGroupType]       = useState("congregation");
  const [groupName, setGroupName]       = useState("");
  const [contactName, setContactName]   = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactMobile, setContactMobile] = useState("");

  const csCount = csProducts.filter((p) => (qty[p.id] ?? 0) > 0).length;
  const faCount = faProducts.filter((p) => (qty[p.id] ?? 0) > 0).length;
  const totalLines = csCount + faCount;

  const canSubmit =
    groupName.trim() &&
    contactName.trim() &&
    contactEmail.trim() &&
    totalLines > 0;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    // Inject qty values
    for (const [productId, q] of Object.entries(qty)) {
      if (q > 0) {
        // Determine dept by checking which list the product is in
        const isCs = csProducts.some((p) => p.id === productId);
        fd.set(isCs ? `cs_${productId}` : `fa_${productId}`, String(q));
      }
    }
    startTransition(() => submitGroupOrder(fd));
  }

  function renderProducts(products: Product[], dept: "CS" | "FA") {
    const grouped = products.reduce<Record<string, Product[]>>((acc, p) => {
      if (!acc[p.category]) acc[p.category] = [];
      acc[p.category].push(p);
      return acc;
    }, {});

    return (
      <div className="space-y-6">
        {Object.entries(grouped).map(([cat, items]) => (
          <div key={cat}>
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
              {CATEGORY_LABELS[cat] ?? cat}
            </p>
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
              {items.map((p, i) => {
                const q = qty[p.id] ?? 0;
                return (
                  <div
                    key={p.id}
                    className={`flex items-center gap-4 px-4 py-3 ${i > 0 ? "border-t border-slate-800" : ""} ${
                      q > 0 ? "bg-green-950/10" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-white leading-tight">
                        {p.name}
                        {p.variant && (
                          <span className="ml-2 text-xs text-slate-400">{p.variant}</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-600">{p.code} · £{p.unitCost.toFixed(2)} each</p>
                    </div>
                    <input
                      type="number"
                      min="0"
                      name={dept === "CS" ? `cs_${p.id}` : `fa_${p.id}`}
                      value={q === 0 ? "" : q}
                      placeholder="0"
                      onChange={(e) =>
                        setQty((prev) => ({ ...prev, [p.id]: parseInt(e.target.value) || 0 }))
                      }
                      className="w-16 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-right text-sm text-white outline-none focus:border-orange-400 placeholder:text-slate-700"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-2xl px-4 py-8">

        {/* Header */}
        <div className="mb-8">
          <p className="text-sm font-semibold text-orange-500">IBSA · Xylo Supplies</p>
          <h1 className="mt-1 text-2xl font-bold text-white">Supply Order Form</h1>
          <p className="mt-1 text-sm text-slate-400">
            Select the products you need and submit your order. We'll be in touch to confirm.
          </p>
        </div>

        {error === "missing-fields" && (
          <div className="mb-6 rounded-xl border border-red-800/40 bg-red-950/20 px-4 py-3 text-sm text-red-400">
            Please fill in all required fields before submitting.
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Group identity */}
          <div className="mb-8 rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
              Your Details
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Group type */}
              <div>
                <label className="mb-1 block text-xs text-slate-500">Group type *</label>
                <select
                  name="groupType"
                  value={groupType}
                  onChange={(e) => setGroupType(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
                >
                  {GROUP_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* Group name */}
              <div>
                <label className="mb-1 block text-xs text-slate-500">
                  {groupType === "congregation" ? "Congregation name *" : groupType === "circuit" ? "Circuit name *" : "Regional name *"}
                </label>
                <input
                  type="text"
                  name="groupName"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder={groupType === "congregation" ? "e.g. London Bethnal Green" : groupType === "circuit" ? "e.g. Circuit 15" : "e.g. Northern Regional"}
                  required
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-orange-500 placeholder:text-slate-600"
                />
              </div>

              {/* Contact name */}
              <div>
                <label className="mb-1 block text-xs text-slate-500">Contact name *</label>
                <input
                  type="text"
                  name="contactName"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Your name"
                  required
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-orange-500 placeholder:text-slate-600"
                />
              </div>

              {/* Contact email */}
              <div>
                <label className="mb-1 block text-xs text-slate-500">Email address *</label>
                <input
                  type="email"
                  name="contactEmail"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-orange-500 placeholder:text-slate-600"
                />
              </div>

              {/* Contact mobile */}
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs text-slate-500">Mobile (optional)</label>
                <input
                  type="tel"
                  name="contactMobile"
                  value={contactMobile}
                  onChange={(e) => setContactMobile(e.target.value)}
                  placeholder="+44 7700 000000"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-orange-500 placeholder:text-slate-600"
                />
              </div>
            </div>
          </div>

          {/* Product tabs */}
          <div className="mb-4 flex gap-2">
            {(["CS", "FA"] as const).map((tab) => {
              const count = tab === "CS" ? csCount : faCount;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                    activeTab === tab
                      ? "bg-white text-slate-900"
                      : "border border-slate-700 text-slate-400 hover:bg-slate-800"
                  }`}
                >
                  {tab === "CS" ? "Cleaning Supplies" : "First Aid"}
                  {count > 0 && (
                    <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${
                      activeTab === tab ? "bg-slate-900 text-white" : "bg-slate-700 text-slate-300"
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Products */}
          {activeTab === "CS"
            ? renderProducts(csProducts, "CS")
            : renderProducts(faProducts, "FA")}

          {/* Submit bar */}
          <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-4">
            {totalLines > 0 ? (
              <p className="mb-3 text-sm text-slate-400">
                <span className="font-semibold text-white">{totalLines}</span> product{totalLines !== 1 ? "s" : ""} selected
                {csCount > 0 && faCount > 0 && (
                  <span className="text-slate-600"> ({csCount} CS · {faCount} FA)</span>
                )}
              </p>
            ) : (
              <p className="mb-3 text-sm text-slate-600">Select at least one product to submit.</p>
            )}
            <button
              type="submit"
              disabled={!canSubmit || isPending}
              className="w-full rounded-xl bg-orange-600 py-3 text-sm font-bold text-white hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isPending ? "Submitting…" : "Submit order"}
            </button>
          </div>

          <p className="mt-4 text-center text-xs text-slate-600">
            You'll receive a confirmation email once your order is submitted.
          </p>
        </form>
      </div>
    </main>
  );
}
