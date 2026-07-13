"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { saveOrderItem } from "../actions";
import { PRODUCT_IMAGE_MAP } from "../../../src/lib/product-images";

type Product = {
  id: string;
  name: string;
  variant: string | null;
  code: string;
  category: string;
  unitCost: number;
};

type Convention = {
  id: string;
  name: string;
  venue: string | null;
  conventionDate: string;
  contactName: string | null;
  isLocked: boolean;
};

type Props = {
  convention: Convention;
  csProducts: Product[];
  faProducts: Product[];
  existingQty: Record<string, number>;
};

const CATEGORY_LABELS: Record<string, string> = {
  safety_ppe: "Safety & PPE",
  janitorial:  "Janitorial",
  chemicals:   "Cleaning Chemicals",
  special:     "Special Order",
  firstaid:    "First Aid",
};

export default function OrderFormClient({ convention, csProducts, faProducts, existingQty }: Props) {
  const [activeTab, setActiveTab] = useState<"CS" | "FA">("CS");
  const [qty, setQty] = useState<Record<string, number>>(existingQty);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved]   = useState<Record<string, boolean>>({});
  const [, startTransition] = useTransition();

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  function save(productId: string, dept: "CS" | "FA", n: number) {
    if (convention.isLocked) return;
    setSaving((prev) => ({ ...prev, [productId]: true }));
    setSaved((prev) => ({ ...prev, [productId]: false }));
    const fd = new FormData();
    fd.set("conventionId", convention.id);
    fd.set("productId", productId);
    fd.set("dept", dept);
    fd.set("qty", String(n));
    startTransition(async () => {
      await saveOrderItem(fd);
      setSaving((prev) => ({ ...prev, [productId]: false }));
      setSaved((prev) => ({ ...prev, [productId]: true }));
      setTimeout(() => setSaved((prev) => ({ ...prev, [productId]: false })), 2000);
    });
  }

  function adjust(productId: string, dept: "CS" | "FA", delta: number) {
    if (convention.isLocked) return;
    const current = qty[productId] ?? 0;
    const next = Math.max(0, current + delta);
    if (next === current) return;
    setQty((prev) => ({ ...prev, [productId]: next }));
    save(productId, dept, next);
  }

  const totalValue = (products: Product[]) =>
    products.reduce((s, p) => s + (qty[p.id] ?? 0) * p.unitCost, 0);

  const totalLines = (products: Product[]) =>
    products.filter((p) => (qty[p.id] ?? 0) > 0).length;

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
                const isSaving = saving[p.id];
                const isSaved  = saved[p.id];

                const imgSrc = PRODUCT_IMAGE_MAP[p.code] ?? null;

                return (
                  <div
                    key={p.id}
                    className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-slate-800" : ""} ${
                      q > 0 ? "bg-green-950/10" : ""
                    }`}
                  >
                    {/* Product image */}
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-800">
                      {imgSrc ? (
                        <Image
                          src={imgSrc}
                          alt={p.name}
                          width={48}
                          height={48}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <div className="h-full w-full" />
                      )}
                    </div>

                    {/* Product info */}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-white leading-tight">
                        {p.name}
                        {p.variant && (
                          <span className="ml-2 text-xs text-slate-400">{p.variant}</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-600">{p.code} · £{p.unitCost.toFixed(2)} each</p>
                    </div>

                    {/* Qty stepper / locked display */}
                    {convention.isLocked ? (
                      <div className="w-12 text-right">
                        <span className={`text-sm font-bold ${q > 0 ? "text-white" : "text-slate-700"}`}>{q}</span>
                      </div>
                    ) : (
                      <div className="flex shrink-0 items-center overflow-hidden rounded-xl border border-slate-700">
                        <button
                          onClick={() => adjust(p.id, dept, -1)}
                          disabled={q === 0 || isSaving}
                          className="flex h-9 w-9 items-center justify-center text-lg font-light text-slate-400 transition-colors hover:bg-slate-800 active:bg-slate-700 disabled:opacity-30"
                          aria-label="Decrease"
                        >
                          −
                        </button>
                        <div className={`flex h-9 min-w-[2.25rem] items-center justify-center border-x border-slate-700 px-1 text-sm font-bold tabular-nums transition-colors ${
                          q > 0 ? "text-white" : "text-slate-600"
                        } ${isSaved ? "text-green-400" : ""}`}>
                          {isSaving ? <span className="text-xs text-slate-500">…</span> : q}
                        </div>
                        <button
                          onClick={() => adjust(p.id, dept, 1)}
                          disabled={isSaving}
                          className="flex h-9 w-9 items-center justify-center text-lg font-light text-slate-400 transition-colors hover:bg-slate-800 active:bg-slate-700 disabled:opacity-30"
                          aria-label="Increase"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const activeProducts = activeTab === "CS" ? csProducts : faProducts;

  // Grand totals across both tabs
  const csLines = totalLines(csProducts);
  const faLines = totalLines(faProducts);
  const csValue = totalValue(csProducts);
  const faValue = totalValue(faProducts);
  const grandLines = csLines + faLines;
  const grandValue = csValue + faValue;

  const fmtGbp = (n: number) =>
    "£" + n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <main className="min-h-screen bg-slate-950 text-white">

      {/* ── Sticky summary bar ──────────────────────────────────────────── */}
      {grandLines > 0 && (
        <div className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/95 backdrop-blur-sm">
          <div className="mx-auto max-w-2xl px-4 py-3">
            {/* Convention name + product count */}
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-xs font-semibold text-slate-400">
                {convention.name}
                <span className="ml-2 font-normal text-slate-600">
                  · {grandLines} product{grandLines !== 1 ? "s" : ""}
                  {csLines > 0 && faLines > 0 && (
                    <> (CS&nbsp;{csLines} · FA&nbsp;{faLines})</>
                  )}
                </span>
              </span>
            </div>
            {/* Ex-VAT / VAT / Total row */}
            <div className="mt-1.5 flex items-center gap-3 text-sm">
              <span className="text-slate-500">
                Ex&nbsp;VAT <span className="font-semibold text-slate-300">{fmtGbp(grandValue)}</span>
              </span>
              <span className="text-slate-700">+</span>
              <span className="text-slate-500">
                VAT <span className="font-semibold text-slate-300">{fmtGbp(grandValue * 0.2)}</span>
              </span>
              <span className="ml-auto text-base font-bold text-green-400">
                {fmtGbp(grandValue * 1.2)}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-2xl px-4 py-8">

        {/* Header */}
        <div className="mb-6">
          <p className="text-sm font-semibold text-orange-500">IBSA · Xylo Supplies</p>
          <h1 className="mt-1 text-2xl font-bold text-white">{convention.name}</h1>
          {convention.venue && (
            <p className="mt-0.5 text-sm text-slate-400">{convention.venue}</p>
          )}
          <p className="mt-1 text-sm text-slate-500">{fmtDate(convention.conventionDate)}</p>
        </div>

        {/* Locked banner */}
        {convention.isLocked && (
          <div className="mb-6 rounded-xl border border-green-800/40 bg-green-950/20 px-4 py-3 text-sm text-green-400">
            ✓ Your order has been received and is being processed. No further changes can be made.
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 flex gap-2">
          {(["CS", "FA"] as const).map((tab) => {
            const count = tab === "CS" ? csLines : faLines;
            return (
              <button
                key={tab}
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

        {/* Product list */}
        {renderProducts(activeProducts, activeTab)}

        {/* Footer note */}
        {!convention.isLocked && (
          <p className="mt-6 text-center text-xs text-slate-600">
            Quantities save automatically as you type. You can come back and adjust until your order is confirmed.
          </p>
        )}
      </div>
    </main>
  );
}
