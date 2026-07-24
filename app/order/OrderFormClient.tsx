"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { submitGroupOrder } from "./actions";
import { getImageSrc } from "../../src/lib/image-utils";

type Product = {
  id: string;
  name: string;
  variant: string | null;
  code: string;
  category: string;
  unitCost: number;
  description: string | null;
  groupDescription: string | null;
  imageUrl: string | null;
  groupImageUrl: string | null;
  groupWithVariants: boolean;
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

const COLOUR_SWATCHES: Record<string, string> = {
  yellow: "#EAB308", orange: "#F97316", red: "#EF4444", pink: "#EC4899",
  blue: "#3B82F6", green: "#22C55E", white: "#F1F5F9", black: "#334155",
  clear: "#94A3B8", grey: "#6B7280", gray: "#6B7280", navy: "#1E3A5F", purple: "#A855F7",
};

function getSwatchColors(label: string): string[] {
  const lower = label.toLowerCase();
  const found: string[] = [];
  for (const [name, hex] of Object.entries(COLOUR_SWATCHES)) {
    if (lower.includes(name) && !found.includes(hex)) found.push(hex);
  }
  return found;
}

function ColourDot({ colors }: { colors: string[] }) {
  if (colors.length === 0) return <span className="inline-block h-4 w-4 shrink-0" />;
  const style = colors.length === 1
    ? { backgroundColor: colors[0] }
    : { background: `linear-gradient(90deg, ${colors[0]} 50%, ${colors[1]} 50%)` };
  return <span className="inline-block h-4 w-4 shrink-0 rounded-full border border-white/15 shadow-sm" style={style} />;
}

const SIZE_ORDER: Record<string, number> = {
  small: 0, s: 0, medium: 1, m: 1, large: 2, l: 2,
  "x-large": 3, xlarge: 3, xl: 3, "xx-large": 4, xxlarge: 4, xxl: 4,
};
const getSize = (v: string | null) => { const k = (v ?? "").toLowerCase().trim(); return SIZE_ORDER[k] ?? 99; };
const getWeight = (v: string | null) => { const m = (v ?? "").match(/(\d+)\s*g/i); return m ? parseInt(m[1]) : 0; };

export default function OrderFormClient({
  csProducts,
  faProducts,
  error,
}: {
  csProducts: Product[];
  faProducts: Product[];
  error?: string;
}) {
  const hasFa = faProducts.length > 0;
  const [activeTab, setActiveTab] = useState<"CS" | "FA">("CS");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [bumped, setBumped] = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");

  const [groupType, setGroupType]             = useState("congregation");
  const [groupName, setGroupName]             = useState("");
  const [contactName, setContactName]         = useState("");
  const [contactEmail, setContactEmail]       = useState("");
  const [contactMobile, setContactMobile]     = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [notes, setNotes]                     = useState("");

  const csLines = csProducts.filter((p) => (qty[p.id] ?? 0) > 0).length;
  const faLines = faProducts.filter((p) => (qty[p.id] ?? 0) > 0).length;
  const totalLines = csLines + faLines;
  const csValue = csProducts.reduce((s, p) => s + (qty[p.id] ?? 0) * p.unitCost, 0);
  const faValue = faProducts.reduce((s, p) => s + (qty[p.id] ?? 0) * p.unitCost, 0);
  const grandValue = csValue + faValue;
  const fmtGbp = (n: number) => "£" + n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const canSubmit = groupName.trim() && contactName.trim() && contactEmail.trim() && totalLines > 0;

  function adjust(productId: string, delta: number) {
    const next = Math.max(0, (qty[productId] ?? 0) + delta);
    setQty((prev) => ({ ...prev, [productId]: next }));
    if (delta > 0) {
      setBumped((prev) => ({ ...prev, [productId]: true }));
      setTimeout(() => setBumped((prev) => ({ ...prev, [productId]: false })), 400);
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    for (const [productId, q] of Object.entries(qty)) {
      if (q > 0) {
        const isCs = csProducts.some((p) => p.id === productId);
        fd.set(isCs ? `cs_${productId}` : `fa_${productId}`, String(q));
      }
    }
    startTransition(() => submitGroupOrder(fd));
  }

  function renderStepper(p: Product) {
    const q = qty[p.id] ?? 0;
    return (
      <div className="flex items-center overflow-hidden rounded-xl border border-slate-600">
        <button type="button" onClick={() => adjust(p.id, -1)} disabled={q === 0}
          className="flex h-10 w-10 items-center justify-center text-xl font-light text-slate-300 bg-slate-800 transition-colors hover:bg-slate-700 active:bg-slate-600 disabled:opacity-25"
          aria-label="Decrease">−</button>
        <div className={`flex h-10 min-w-[2.75rem] items-center justify-center border-x border-slate-600 px-1 text-base font-bold tabular-nums ${q > 0 ? "text-white" : "text-slate-500"}`}>
          {q}
        </div>
        <button type="button" onClick={() => adjust(p.id, 1)}
          className="flex h-10 w-10 items-center justify-center text-xl font-light text-white bg-orange-500 transition-colors hover:bg-orange-400 active:bg-orange-600"
          aria-label="Increase">+</button>
      </div>
    );
  }

  function renderProducts(products: Product[]) {
    const filtered = search.trim()
      ? products.filter((p) => {
          const q = search.toLowerCase();
          return p.name.toLowerCase().includes(q) || (p.variant ?? "").toLowerCase().includes(q);
        })
      : products;

    const byCat = filtered.reduce<Record<string, Product[]>>((acc, p) => {
      (acc[p.category] ??= []).push(p);
      return acc;
    }, {});

    return (
      <div className="space-y-8">
        {Object.entries(byCat).map(([cat, items]) => {
          const familyMap = new Map<string, Product[]>();
          for (const p of items) {
            const key = p.groupWithVariants ? p.name : p.id;
            (familyMap.get(key) ?? familyMap.set(key, []).get(key)!).push(p);
          }
          return (
            <div key={cat}>
              <p className="mb-3 px-1 text-xs font-bold uppercase tracking-widest text-slate-400">
                {CATEGORY_LABELS[cat] ?? cat}
              </p>
              <div className="space-y-3">
                {Array.from(familyMap.values()).map((group) => {
                  const first = group[0];
                  const groupImgUrl = group.find((p) => p.groupImageUrl)?.groupImageUrl ?? null;
                  const imgSrc = getImageSrc(groupImgUrl ?? first.imageUrl);
                  const isSingle = group.length === 1;

                  if (isSingle) {
                    const p = first;
                    const variantLabel = p.variant ?? "";
                    const swatchColors = getSwatchColors(variantLabel);
                    const ordered = (qty[p.id] ?? 0) > 0;
                    return (
                      <div key={p.id} className={`overflow-hidden rounded-2xl border bg-slate-800 shadow-lg shadow-black/30 transition-colors ${ordered ? "border-orange-500/60 shadow-orange-900/20" : "border-slate-600"} ${bumped[p.id] ? "card-lift" : ""}`}>
                        <div className="flex items-center gap-4 p-4">
                          <div className="w-24 h-24 shrink-0 overflow-hidden rounded-xl bg-slate-800">
                            {imgSrc
                              ? <Image src={imgSrc} alt={p.name} width={96} height={96} className="h-full w-full object-contain" />
                              : <div className="h-full w-full" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              {swatchColors.length > 0 && <ColourDot colors={swatchColors} />}
                              <p className="text-base font-bold leading-snug text-white">{p.name}</p>
                            </div>
                            {variantLabel && <p className="mt-0.5 text-sm text-slate-400">{variantLabel}</p>}
                            {p.description && <p className="mt-0.5 text-xs italic text-slate-400">{p.description}</p>}
                            <p className="mt-1 text-xs text-slate-500">£{p.unitCost.toFixed(2)} each</p>
                          </div>
                          <div className="shrink-0 flex items-center gap-2">
                            {renderStepper(p)}
                            <span className={`text-sm font-semibold text-green-500 w-16 text-right ${ordered ? "visible" : "invisible"}`}>= {fmtGbp((qty[p.id] ?? 0) * p.unitCost)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  const anyOrdered = group.some((p) => (qty[p.id] ?? 0) > 0);
                  const anyBumped  = group.some((p) => bumped[p.id]);
                  return (
                    <div key={first.name} className={`overflow-hidden rounded-2xl border bg-slate-800 shadow-lg shadow-black/30 transition-colors ${anyOrdered ? "border-orange-500/60 shadow-orange-900/20" : "border-slate-600"} ${anyBumped ? "card-lift" : ""}`}>
                      <div className="flex gap-4 px-4 pt-4 pb-3 items-center">
                        <div className="w-16 h-16 shrink-0 overflow-hidden rounded-xl bg-slate-800">
                          {imgSrc
                            ? <Image src={imgSrc} alt={first.name} width={64} height={64} className="h-full w-full object-contain" />
                            : <div className="h-full w-full" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-base font-bold leading-snug text-white">{first.name}</p>
                          {group.find(p => p.groupDescription)?.groupDescription && (
                            <p className="mt-0.5 text-xs italic text-slate-400">{group.find(p => p.groupDescription)?.groupDescription}</p>
                          )}
                        </div>
                      </div>
                      <div className="border-t border-slate-700 divide-y divide-slate-700/60">
                        {[...group].sort((a, b) => {
                          const sA = getSize(a.variant), sB = getSize(b.variant);
                          if (sA !== 99 || sB !== 99) return sA - sB;
                          const wA = getWeight(a.variant), wB = getWeight(b.variant);
                          if (wA !== wB) return wA - wB;
                          return (a.variant ?? "").localeCompare(b.variant ?? "");
                        }).map((p) => {
                          const variantImgSrc = getImageSrc(p.imageUrl);
                          const variantLabel = p.variant ?? "";
                          const swatchColors = getSwatchColors(variantLabel);
                          const ordered = (qty[p.id] ?? 0) > 0;
                          return (
                            <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                              <div className="w-14 h-14 shrink-0 overflow-hidden rounded-lg bg-slate-800">
                                {variantImgSrc
                                  ? <Image src={variantImgSrc} alt={variantLabel || p.name} width={56} height={56} className="h-full w-full object-contain" />
                                  : <div className="h-full w-full" />}
                              </div>
                              {swatchColors.length > 0 ? <ColourDot colors={swatchColors} /> : <span className="w-4 shrink-0" />}
                              <div className="min-w-0 flex-1">
                                <p className="text-sm text-slate-300">{variantLabel || p.name}</p>
                                <p className="text-xs text-slate-500">£{p.unitCost.toFixed(2)} each</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {renderStepper(p)}
                                <span className={`text-sm font-semibold text-green-500 w-16 text-right ${ordered ? "visible" : "invisible"}`}>= {fmtGbp((qty[p.id] ?? 0) * p.unitCost)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-900 text-white">
      <style>{`
        @keyframes lift {
          0%   { transform: translateY(0)   scale(1);    box-shadow: none; }
          35%  { transform: translateY(-6px) scale(1.01); box-shadow: 0 16px 40px rgba(0,0,0,0.4); }
          100% { transform: translateY(0)   scale(1);    box-shadow: none; }
        }
        .card-lift { animation: lift 0.38s cubic-bezier(0.22,0.61,0.36,1) both; }
      `}</style>

      {/* Sticky summary bar */}
      {totalLines > 0 && (
        <div className="sticky top-0 z-30 bg-slate-800/95 backdrop-blur-md shadow-lg shadow-black/40 border-b border-slate-700">
          <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between gap-4">
            <p className="text-xs font-bold text-white">
              {totalLines} item{totalLines !== 1 ? "s" : ""}
              {csLines > 0 && faLines > 0 && <span className="font-normal text-slate-400"> (CS {csLines} · FA {faLines})</span>}
            </p>
            <p className="text-sm font-bold text-orange-400">{fmtGbp(grandValue)} ex VAT</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mx-auto max-w-2xl px-4 py-8">

          {/* Header */}
          <div className="mb-8">
            <p className="text-sm font-semibold text-orange-500">IBSA · Xylo (UK) Ltd</p>
            <h1 className="mt-1 text-2xl font-bold text-white">Supply Order Form</h1>
            <p className="mt-1 text-sm text-slate-400">Select the products you need and submit your order. We&apos;ll be in touch to confirm.</p>
          </div>

          {error === "missing-fields" && (
            <div className="mb-6 rounded-xl border border-red-800/40 bg-red-950/20 px-4 py-3 text-sm text-red-400">
              Please fill in all required fields before submitting.
            </div>
          )}
          {error === "no-items" && (
            <div className="mb-6 rounded-xl border border-red-800/40 bg-red-950/20 px-4 py-3 text-sm text-red-400">
              Please add at least one item to your order.
            </div>
          )}

          {/* Your details */}
          <div className="mb-8 rounded-2xl border border-slate-700 bg-slate-800 p-5">
            <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">Your Details</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-slate-500">Group type *</label>
                <select name="groupType" value={groupType} onChange={(e) => setGroupType(e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2.5 text-sm text-white outline-none focus:border-orange-500">
                  {GROUP_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">
                  {groupType === "congregation" ? "Congregation name *" : groupType === "circuit" ? "Circuit name *" : "Regional name *"}
                </label>
                <input type="text" name="groupName" value={groupName} onChange={(e) => setGroupName(e.target.value)}
                  placeholder={groupType === "congregation" ? "e.g. London Bethnal Green" : groupType === "circuit" ? "e.g. Circuit 15" : "e.g. Northern Regional"}
                  required className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2.5 text-sm text-white outline-none focus:border-orange-500 placeholder:text-slate-600" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Contact name *</label>
                <input type="text" name="contactName" value={contactName} onChange={(e) => setContactName(e.target.value)}
                  placeholder="Your name" required
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2.5 text-sm text-white outline-none focus:border-orange-500 placeholder:text-slate-600" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Email address *</label>
                <input type="email" name="contactEmail" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="you@example.com" required
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2.5 text-sm text-white outline-none focus:border-orange-500 placeholder:text-slate-600" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Mobile (optional)</label>
                <input type="tel" name="contactMobile" value={contactMobile} onChange={(e) => setContactMobile(e.target.value)}
                  placeholder="+44 7700 000000"
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2.5 text-sm text-white outline-none focus:border-orange-500 placeholder:text-slate-600" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Delivery address (optional)</label>
                <textarea name="deliveryAddress" rows={3} value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder={"Hall / Venue name\nStreet address\nCity, Postcode"}
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-orange-500 placeholder:text-slate-600 resize-none" />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs text-slate-500">Additional notes (optional)</label>
                <textarea name="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. preferred delivery time, access instructions…"
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-orange-500 placeholder:text-slate-600 resize-none" />
              </div>
            </div>
          </div>

          {/* Product tabs */}
          <div className="mb-5 flex gap-2">
            {(["CS", ...(hasFa ? ["FA"] : [])] as ("CS" | "FA")[]).map((tab) => {
              const count = tab === "CS" ? csLines : faLines;
              return (
                <button key={tab} type="button" onClick={() => setActiveTab(tab)}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${activeTab === tab ? "bg-white text-slate-900" : "border border-slate-700 text-slate-400 hover:bg-slate-800"}`}>
                  {tab === "CS" ? "Cleaning Supplies" : "First Aid"}
                  {count > 0 && (
                    <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${activeTab === tab ? "bg-slate-900 text-white" : "bg-slate-700 text-slate-300"}`}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="mb-5 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input type="search" placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2.5 pl-9 pr-4 text-sm text-white placeholder-slate-500 focus:border-slate-500 focus:outline-none" />
          </div>

          {/* Products */}
          {renderProducts(activeTab === "CS" ? csProducts : faProducts)}

          {/* Submit */}
          <div className="mt-8 rounded-2xl border border-slate-700 bg-slate-800 p-4">
            {totalLines > 0 ? (
              <p className="mb-3 text-sm text-slate-400">
                <span className="font-semibold text-white">{totalLines}</span> product{totalLines !== 1 ? "s" : ""} · <span className="font-semibold text-orange-400">{fmtGbp(grandValue)}</span> ex VAT
              </p>
            ) : (
              <p className="mb-3 text-sm text-slate-600">Select at least one product to submit.</p>
            )}
            <button type="submit" disabled={!canSubmit || isPending}
              className="w-full rounded-xl bg-orange-500 py-3 text-sm font-bold text-white hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              {isPending ? "Submitting…" : "Submit order"}
            </button>
          </div>

          <p className="mt-4 text-center text-xs text-slate-600">
            You&apos;ll receive a confirmation email once your order is submitted.
          </p>
        </div>
      </form>
    </main>
  );
}
