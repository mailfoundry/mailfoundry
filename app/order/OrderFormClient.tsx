"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { submitGroupOrder } from "./actions";
import { getImageSrc } from "../../src/lib/image-utils";
import AddressAutocomplete from "./AddressAutocomplete";

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
  gloves:      "Gloves",
  hivis:       "Hi Vis",
};

// ── Product carousel ───────────────────────────────────────────────────────────
const CAROUSEL_IMAGES = [
  { src: "/product-images/cs_HI_VIS_YELLOW_S.png",               alt: "Hi Vis" },
  { src: "/product-images/fa_GLOVES_VINYL_CLEAR_SML.jpg",         alt: "Gloves" },
  { src: "/product-images/fa_FACEMASK_BLUE_50PACK.png",           alt: "Face Masks" },
  { src: "/product-images/fa_FIRSTAID_KIT_LARGE_188P.png",        alt: "First Aid Kit" },
  { src: "/product-images/cs_CLOVER_DETAK_750ML.png",             alt: "Cleaning Chemical" },
  { src: "/product-images/cs_CLOTH_MFIBRE_BLUE_10PK.jpg",         alt: "Cloths" },
  { src: "/product-images/cs_HI_VIS_ORANGE_S.jpg",                alt: "Hi Vis Orange" },
  { src: "/product-images/cs_GLOVES_NITRILE-POLY_FOAM_S_10PACK.png", alt: "Nitrile Gloves" },
  { src: "/product-images/fa_SPILL_KITS_MAINTENANCE_20L.jpg",     alt: "Spill Kit" },
  { src: "/product-images/cs_BARRIER_TAPE_NON_ADHESIVE_RED_WHITE.png", alt: "Barrier Tape" },
  { src: "/product-images/fa_APRONS_FLTPACK_100PK.jpg",           alt: "Aprons" },
  { src: "/product-images/cs_SQUEEGEE_METAL_55CM.png",            alt: "Squeegee" },
];

function ProductCarousel() {
  // Duplicate for seamless loop
  const all = [...CAROUSEL_IMAGES, ...CAROUSEL_IMAGES];
  return (
    <div className="relative overflow-hidden rounded-xl bg-gray-50 border border-gray-100 py-2 mb-4">
      <style>{`
        @keyframes carousel-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .carousel-track { animation: carousel-scroll 28s linear infinite; }
        .carousel-track:hover { animation-play-state: paused; }
      `}</style>
      <div className="carousel-track flex gap-3 w-max px-2">
        {all.map((img, i) => (
          <div
            key={i}
            className="h-14 w-14 shrink-0 rounded-lg bg-white border border-gray-100 flex items-center justify-center overflow-hidden shadow-sm"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.src}
              alt={img.alt}
              className="h-12 w-12 object-contain"
              loading="lazy"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

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
  return <span className="inline-block h-4 w-4 shrink-0 rounded-full border border-black/10 shadow-sm" style={style} />;
}

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

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SIZE_ORDER: Record<string, number> = {
  small: 0, s: 0, medium: 1, m: 1, large: 2, l: 2,
  "x-large": 3, xlarge: 3, xl: 3, "xx-large": 4, xxlarge: 4, xxl: 4,
};
const getSize = (v: string | null) => { const k = (v ?? "").toLowerCase().trim(); return SIZE_ORDER[k] ?? 99; };
const getWeight = (v: string | null) => { const m = (v ?? "").match(/(\d+)\s*g/i); return m ? parseInt(m[1]) : 0; };

type Prefill = {
  groupType: string; groupName: string; contactName: string;
  contactEmail: string; contactMobile: string; deliveryAddress: string;
} | null;

export default function OrderFormClient({
  csProducts,
  faProducts,
  error,
  prefill,
}: {
  csProducts: Product[];
  faProducts: Product[];
  error?: string;
  prefill?: Prefill;
}) {
  const hasFa = faProducts.length > 0;
  const [activeTab, setActiveTab] = useState<"CS" | "FA">("CS");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [bumped, setBumped] = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const [groupType, setGroupType]             = useState(prefill?.groupType ?? "congregation");
  const [groupName, setGroupName]             = useState(prefill?.groupName ?? "");
  const [contactName, setContactName]         = useState(prefill?.contactName ?? "");
  const [contactEmail, setContactEmail]       = useState(prefill?.contactEmail ?? "");
  const [contactMobile, setContactMobile]     = useState(prefill?.contactMobile ?? "");
  const [requiredByDate, setRequiredByDate]   = useState("");
  const [notes, setNotes]                     = useState("");
  const [paymentMethod, setPaymentMethod]     = useState<"bacs" | "card" | "po" | "">("");
  const [emailTouched, setEmailTouched]       = useState(false);

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
      <div className="flex items-center overflow-hidden rounded-xl border border-gray-300">
        <button type="button" onClick={() => adjust(p.id, -1)} disabled={q === 0}
          className="flex h-10 w-10 items-center justify-center text-xl font-light text-gray-600 bg-gray-100 transition-colors hover:bg-gray-200 active:bg-gray-300 disabled:opacity-25"
          aria-label="Decrease">−</button>
        <input
          type="number"
          min={0}
          value={q === 0 ? "" : q}
          placeholder="0"
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            const next = isNaN(val) ? 0 : Math.max(0, val);
            setQty((prev) => ({ ...prev, [p.id]: next }));
            if (next > (qty[p.id] ?? 0)) {
              setBumped((prev) => ({ ...prev, [p.id]: true }));
              setTimeout(() => setBumped((prev) => ({ ...prev, [p.id]: false })), 400);
            }
          }}
          className="h-10 w-14 border-x border-gray-300 text-center text-base font-bold tabular-nums text-gray-900 placeholder:text-gray-400 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none bg-white"
        />
        <button type="button" onClick={() => adjust(p.id, 1)}
          className="flex h-10 w-10 items-center justify-center text-xl font-light text-white bg-orange-500 transition-colors hover:bg-orange-400 active:bg-orange-600"
          aria-label="Increase">+</button>
      </div>
    );
  }

  function renderProducts(products: Product[]) {
    const filtered = products
      .filter((p) => categoryFilter === "all" || p.category === categoryFilter)
      .filter((p) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return p.name.toLowerCase().includes(q) || (p.variant ?? "").toLowerCase().includes(q);
      });

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
              <p className="mb-3 px-1 text-xs font-bold uppercase tracking-widest text-gray-400">
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
                      <div key={p.id} className={`rounded-2xl border bg-white shadow-sm transition-colors ${ordered ? "border-orange-400 shadow-orange-100" : "border-gray-200"} ${bumped[p.id] ? "card-lift" : ""}`}>
                        <div className="flex items-center gap-4 p-4">
                          <div className="relative shrink-0 group cursor-zoom-in">
                            <div className="w-24 h-24 overflow-hidden rounded-xl bg-gray-50">
                              {imgSrc
                                ? <Image src={imgSrc} alt={p.name} width={96} height={96} className="h-full w-full object-contain" />
                                : <div className="h-full w-full" />}
                            </div>
                            {imgSrc && (
                              <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 h-52 w-52 -translate-y-1/2 overflow-hidden rounded-xl border border-gray-200 bg-white p-2 shadow-2xl shadow-gray-400/30 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                                <Image src={imgSrc} alt={p.name} width={208} height={208} className="h-full w-full object-contain" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              {swatchColors.length > 0 && <ColourDot colors={swatchColors} />}
                              <p className="text-base font-bold leading-snug text-gray-900">{p.name}</p>
                            </div>
                            {variantLabel && <p className="mt-0.5 text-sm text-gray-500">{variantLabel}</p>}
                            {p.description && <p className="mt-0.5 text-xs italic text-gray-500">{p.description}</p>}
                            <p className="mt-1 text-xs text-gray-600">£{p.unitCost.toFixed(2)} each</p>
                          </div>
                          <div className="shrink-0 flex items-center gap-2">
                            {renderStepper(p)}
                            <span className={`text-sm font-semibold text-green-600 w-16 text-right ${ordered ? "visible" : "invisible"}`}>= {fmtGbp((qty[p.id] ?? 0) * p.unitCost)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  const anyOrdered = group.some((p) => (qty[p.id] ?? 0) > 0);
                  const anyBumped  = group.some((p) => bumped[p.id]);
                  return (
                    <div key={first.name} className={`rounded-2xl border bg-white shadow-sm transition-colors ${anyOrdered ? "border-orange-400 shadow-orange-100" : "border-gray-200"} ${anyBumped ? "card-lift" : ""}`}>
                      <div className="flex gap-4 px-4 pt-4 pb-3 items-center">
                        <div className="relative shrink-0 group cursor-zoom-in">
                          <div className="w-16 h-16 overflow-hidden rounded-xl bg-gray-50">
                            {imgSrc
                              ? <Image src={imgSrc} alt={first.name} width={64} height={64} className="h-full w-full object-contain" />
                              : <div className="h-full w-full" />}
                          </div>
                          {imgSrc && (
                            <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 h-52 w-52 -translate-y-1/2 overflow-hidden rounded-xl border border-gray-200 bg-white p-2 shadow-2xl shadow-gray-400/30 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                              <Image src={imgSrc} alt={first.name} width={208} height={208} className="h-full w-full object-contain" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-base font-bold leading-snug text-gray-900">{first.name}</p>
                          {group.find(p => p.groupDescription)?.groupDescription && (
                            <p className="mt-0.5 text-xs italic text-gray-500">{group.find(p => p.groupDescription)?.groupDescription}</p>
                          )}
                        </div>
                      </div>
                      <div className="border-t border-gray-200 divide-y divide-gray-100">
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
                              <div className="relative shrink-0 group cursor-zoom-in">
                                <div className="w-14 h-14 overflow-hidden rounded-lg bg-gray-50">
                                  {variantImgSrc
                                    ? <Image src={variantImgSrc} alt={variantLabel || p.name} width={56} height={56} className="h-full w-full object-contain" />
                                    : <div className="h-full w-full" />}
                                </div>
                                {variantImgSrc && (
                                  <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 h-44 w-44 -translate-y-1/2 overflow-hidden rounded-xl border border-gray-200 bg-white p-2 shadow-2xl shadow-gray-400/30 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                                    <Image src={variantImgSrc} alt={variantLabel || p.name} width={176} height={176} className="h-full w-full object-contain" />
                                  </div>
                                )}
                              </div>
                              {swatchColors.length > 0 ? <ColourDot colors={swatchColors} /> : <span className="w-4 shrink-0" />}
                              <div className="min-w-0 flex-1">
                                <p className="text-sm text-gray-700">{variantLabel || p.name}</p>
                                <p className="text-xs text-gray-600">£{p.unitCost.toFixed(2)} each</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {renderStepper(p)}
                                <span className={`text-sm font-semibold text-green-600 w-16 text-right ${ordered ? "visible" : "invisible"}`}>= {fmtGbp((qty[p.id] ?? 0) * p.unitCost)}</span>
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
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <style>{`
        @keyframes lift {
          0%   { transform: translateY(0)   scale(1);    box-shadow: none; }
          35%  { transform: translateY(-6px) scale(1.01); box-shadow: 0 16px 40px rgba(0,0,0,0.08); }
          100% { transform: translateY(0)   scale(1);    box-shadow: none; }
        }
        .card-lift { animation: lift 0.38s cubic-bezier(0.22,0.61,0.36,1) both; }
      `}</style>

      {/* Sticky summary bar */}
      {totalLines > 0 && (
        <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-200">
          <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between gap-4">
            <p className="text-xs font-bold text-gray-900">
              {totalLines} item{totalLines !== 1 ? "s" : ""}
              {csLines > 0 && faLines > 0 && <span className="font-normal text-gray-500"> (CS {csLines} · FA {faLines})</span>}
            </p>
            <p className="text-sm font-bold text-orange-500">{fmtGbp(grandValue)} ex VAT</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mx-auto max-w-4xl px-4 py-8">

          {/* Header */}
          <div className="mb-8">
            <p className="text-sm font-semibold text-orange-500">IBSA · Xylo (UK) Ltd</p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">Supply Order Form</h1>
            <p className="mt-1 text-sm text-gray-500">Select the products you need and submit your order. We&apos;ll be in touch to confirm.</p>
          </div>

          {error === "missing-fields" && (
            <div className="mb-6 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-600">
              Please fill in all required fields before submitting.
            </div>
          )}
          {error === "no-items" && (
            <div className="mb-6 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-600">
              Please add at least one item to your order.
            </div>
          )}

          {/* Your details */}
          <div className="mb-8 rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
            <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-400">Your Details</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-gray-500">Group type *</label>
                <select name="groupType" value={groupType} onChange={(e) => setGroupType(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-500">
                  {GROUP_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">
                  {groupType === "congregation" ? "Congregation name *" : groupType === "circuit" ? "Circuit name *" : "Regional name *"}
                </label>
                <input type="text" name="groupName" value={groupName} onChange={(e) => setGroupName(e.target.value)}
                  placeholder={groupType === "congregation" ? "e.g. London Bethnal Green" : groupType === "circuit" ? "e.g. North West 10B" : "e.g. Regional Name / Venue"}
                  required className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-500 placeholder:text-gray-400" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Contact name *</label>
                <input type="text" name="contactName" value={contactName} onChange={(e) => setContactName(e.target.value)}
                  placeholder="Your name" required
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-500 placeholder:text-gray-400" />
              </div>
              <div>
                <label className="mb-1 flex items-center justify-between text-xs text-gray-500">
                  <span>Email address *</span>
                  {contactEmail && emailRegex.test(contactEmail) && (
                    <span className="text-green-500 font-medium">✓</span>
                  )}
                  {emailTouched && contactEmail && !emailRegex.test(contactEmail) && (
                    <span className="text-red-500 font-medium">Invalid email</span>
                  )}
                </label>
                <input type="email" name="contactEmail" value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value.toLowerCase())}
                  onBlur={(e) => { setContactEmail(e.target.value.trim().toLowerCase()); setEmailTouched(true); }}
                  placeholder="you@example.com" required
                  className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 ${
                    !emailTouched ? "border-gray-300 focus:border-orange-500" :
                    emailRegex.test(contactEmail) ? "border-green-400 focus:border-green-500" :
                    "border-red-400 focus:border-red-500"
                  }`} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Mobile *</label>
                <input type="tel" name="contactMobile" value={contactMobile}
                  onChange={(e) => setContactMobile(formatUKMobile(e.target.value))}
                  placeholder="07700 123 456"
                  required
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-500 placeholder:text-gray-400" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Required by date</label>
                <input type="date" name="requiredByDate" value={requiredByDate} onChange={(e) => setRequiredByDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-500" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Delivery address *</label>
                <AddressAutocomplete
                  required
                  defaultValue={prefill?.deliveryAddress ?? ""}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-500 placeholder:text-gray-400"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs text-gray-500">Additional notes (optional)</label>
                <textarea name="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. preferred delivery time, access instructions…"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-orange-500 placeholder:text-gray-400 resize-none" />
              </div>
            </div>
          </div>

          {/* Payment preference */}
          <div className="mb-5 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-400">Payment Preference</h2>
            <p className="mb-4 text-sm text-gray-500">How do you intend to pay? No payment is taken now — we&apos;ll follow up with the relevant details after confirming your order.</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {([
                { value: "bacs",  label: "BACS Transfer",        desc: "Pay by bank transfer using our account details" },
                { value: "card",  label: "Credit / Debit Card",  desc: "We'll send a secure Stripe payment link" },
                { value: "po",    label: "Purchase Order",        desc: "Raise a PO and we'll invoice your organisation" },
              ] as const).map(({ value, label, desc }) => (
                <label key={value}
                  className={`flex cursor-pointer flex-col gap-1 rounded-xl border p-4 transition-colors ${paymentMethod === value ? "border-orange-400 bg-orange-50" : "border-gray-200 hover:border-gray-300"}`}>
                  <input type="radio" name="paymentMethod" value={value}
                    checked={paymentMethod === value}
                    onChange={() => setPaymentMethod(value)}
                    className="sr-only" />
                  <span className="text-sm font-semibold text-gray-900">{label}</span>
                  <span className="text-xs text-gray-500">{desc}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Product tabs — CS / FA */}
          <div className="mb-3 flex gap-2">
            {(["CS", ...(hasFa ? ["FA"] : [])] as ("CS" | "FA")[]).map((tab) => {
              const count = tab === "CS" ? csLines : faLines;
              return (
                <button key={tab} type="button" onClick={() => { setActiveTab(tab); setCategoryFilter("all"); }}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${activeTab === tab ? "bg-gray-900 text-white" : "border border-gray-300 text-gray-500 hover:bg-gray-100"}`}>
                  {tab === "CS" ? "Cleaning Supplies" : "First Aid"}
                  {count > 0 && (
                    <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${activeTab === tab ? "bg-white text-gray-900" : "bg-gray-200 text-gray-600"}`}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Category filter tabs */}
          {(() => {
            const activeProducts = activeTab === "CS" ? csProducts : faProducts;
            const cats = [...new Set(activeProducts.map(p => p.category))];
            if (cats.length <= 1) return null;
            return (
              <>
                <div className="mb-1 flex flex-wrap gap-2">
                  <button type="button" onClick={() => setCategoryFilter("all")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${categoryFilter === "all" ? "bg-orange-500 text-white" : "border border-gray-200 text-gray-500 hover:bg-gray-100"}`}>
                    All
                  </button>
                  {cats.map(cat => {
                    const catCount = activeProducts.filter(p => p.category === cat && (qty[p.id] ?? 0) > 0).length;
                    return (
                      <button key={cat} type="button" onClick={() => setCategoryFilter(cat)}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${categoryFilter === cat ? "bg-orange-500 text-white" : "border border-gray-200 text-gray-500 hover:bg-gray-100"}`}>
                        {CATEGORY_LABELS[cat] ?? cat}
                        {catCount > 0 && (
                          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${categoryFilter === cat ? "bg-white text-orange-500" : "bg-gray-200 text-gray-600"}`}>{catCount}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="mb-3 text-[11px] text-gray-400">
                  Pick a category to narrow the list, or search below to find a specific item.
                </p>
              </>
            );
          })()}

          {/* Product image carousel */}
          <ProductCarousel />

          {/* Search */}
          <div className="mb-5 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input type="search" placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-9 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-orange-400 focus:outline-none" />
          </div>

          {/* Products */}
          {renderProducts(activeTab === "CS" ? csProducts : faProducts)}

          {/* Submit */}
          <div className="mt-8 rounded-2xl border border-gray-200 bg-white shadow-sm p-4">
            {totalLines > 0 ? (
              <p className="mb-3 text-sm text-gray-600">
                <span className="font-semibold text-gray-900">{totalLines}</span> product{totalLines !== 1 ? "s" : ""} · <span className="font-semibold text-orange-500">{fmtGbp(grandValue)}</span> ex VAT
              </p>
            ) : (
              <p className="mb-3 text-sm text-gray-400">Select at least one product to submit.</p>
            )}
            <button type="submit" disabled={!canSubmit || isPending}
              className="w-full rounded-xl bg-orange-500 py-3 text-sm font-bold text-white hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              {isPending ? "Submitting…" : "Submit order"}
            </button>
          </div>

          <p className="mt-4 text-center text-xs text-gray-400">
            You&apos;ll receive a confirmation email once your order is submitted.
          </p>
        </div>
      </form>
    </main>
  );
}
