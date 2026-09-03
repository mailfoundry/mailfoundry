"use client";

import { useState, useTransition, useEffect } from "react";
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
  venueType: string;
  sectionLabel: string | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  safety_ppe: "Safety & PPE",
  janitorial:  "Janitorial",
  chemicals:   "Cleaning Chemicals",
  special:     "Special Order",
  firstaid:    "First Aid",
  gloves:      "Gloves",
  hivis:       "Hi Vis",
  brushes_handles: "Brushes & Handles",
  mops_buckets: "Mops & Buckets",
};

// Categories that roll up into a parent for filter display
const CATEGORY_PARENT: Record<string, string> = {};

// ── Product carousel ───────────────────────────────────────────────────────────
const DEFAULT_CAROUSEL_IMAGES = [
  { src: "/product-images/cs_HI_VIS_YELLOW_S.png",                  alt: "Hi Vis" },
  { src: "/product-images/fa_GLOVES_VINYL_CLEAR_SML.jpg",            alt: "Gloves" },
  { src: "/product-images/fa_FACEMASK_BLUE_50PACK.png",              alt: "Face Masks" },
  { src: "/product-images/fa_FIRSTAID_KIT_LARGE_188P.png",           alt: "First Aid Kit" },
  { src: "/product-images/cs_CLOVER_DETAK_750ML.png",                alt: "Cleaning Chemical" },
  { src: "/product-images/cs_CLOTH_MFIBRE_BLUE_10PK.jpg",            alt: "Cloths" },
  { src: "/product-images/cs_HI_VIS_ORANGE_S.jpg",                   alt: "Hi Vis Orange" },
  { src: "/product-images/cs_GLOVES_NITRILE-POLY_FOAM_S_10PACK.png", alt: "Nitrile Gloves" },
  { src: "/product-images/fa_SPILL_KITS_MAINTENANCE_20L.jpg",        alt: "Spill Kit" },
  { src: "/product-images/cs_BARRIER_TAPE_NON_ADHESIVE_RED_WHITE.png", alt: "Barrier Tape" },
  { src: "/product-images/fa_APRONS_FLTPACK_100PK.jpg",              alt: "Aprons" },
  { src: "/product-images/cs_SQUEEGEE_METAL_55CM.png",               alt: "Squeegee" },
];

type CarouselImage = { src: string; alt: string };

function ProductCarousel({ images, animKey }: { images: CarouselImage[]; animKey: string }) {
  // Pad short lists so the scroll looks natural, then duplicate for seamless loop
  const base = images.length >= 4 ? images : DEFAULT_CAROUSEL_IMAGES;
  const needed = Math.max(12, base.length);
  const padded: CarouselImage[] = [];
  while (padded.length < needed) padded.push(...base);
  const all = [...padded, ...padded];

  const duration = Math.max(14, padded.length * 2.2);

  return (
    <div key={animKey} className="relative overflow-hidden rounded-xl bg-gray-50 border border-gray-100 py-2 mb-4 carousel-wrap">
      <style>{`
        @keyframes carousel-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes carousel-fade-in {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .carousel-track { animation: carousel-scroll ${duration}s linear infinite; }
        .carousel-track:hover { animation-play-state: paused; }
        .carousel-wrap { animation: carousel-fade-in 0.35s ease both; }
      `}</style>
      <div className="carousel-track flex gap-3 w-max px-2">
        {all.map((img, i) => (
          <div
            key={i}
            className="h-14 w-14 shrink-0 rounded-lg bg-white border border-gray-100 flex items-center justify-center overflow-hidden shadow-sm"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.src} alt={img.alt} className="h-12 w-12 object-contain" loading="lazy" />
          </div>
        ))}
      </div>
    </div>
  );
}

const GROUP_TYPES = [
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

function getSize(v: string | null): number {
  if (!v) return 99;
  const k = v.toLowerCase().replace(/[^a-z0-9]/g, "");
  return (
    { s: 0, small: 0, m: 1, medium: 1, med: 1, l: 2, large: 2,
      xl: 3, xlarge: 3, extralarge: 3,
      xxl: 4, xxlarge: 4, extraextralarge: 4,
      xxxl: 5, xxxlarge: 5 } as Record<string, number>
  )[k] ?? 99;
}
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

  const [groupType, setGroupType]             = useState(prefill?.groupType ?? "circuit");
  const [groupName, setGroupName]             = useState(prefill?.groupName ?? "");
  const [contactName, setContactName]         = useState(prefill?.contactName ?? "");
  const [contactEmail, setContactEmail]       = useState(prefill?.contactEmail ?? "");
  const [contactMobile, setContactMobile]     = useState(prefill?.contactMobile ?? "");
  const [requiredByDate, setRequiredByDate]   = useState("");
  const [notes, setNotes]                     = useState("");
  const paymentMethod = "po";
  const [emailTouched, setEmailTouched]       = useState(false);

  // Scroll to top after the new tab's content has rendered.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeTab]);

  // Filter products by venue type based on the selected group type.
  // "circuit" groups see "all" + "circuit" products.
  // "regional" groups see "all" + "large" products.
  const venueMatch = groupType === "circuit" ? ["all", "circuit"] : ["all", "large"];
  const visibleCs = csProducts.filter((p) => venueMatch.includes(p.venueType ?? "all"));
  const visibleFa = faProducts.filter((p) => venueMatch.includes(p.venueType ?? "all"));

  const csLines = visibleCs.filter((p) => (qty[p.id] ?? 0) > 0).length;
  const faLines = visibleFa.filter((p) => (qty[p.id] ?? 0) > 0).length;
  const totalLines = csLines + faLines;
  const csValue = visibleCs.reduce((s, p) => s + (qty[p.id] ?? 0) * p.unitCost, 0);
  const faValue = visibleFa.reduce((s, p) => s + (qty[p.id] ?? 0) * p.unitCost, 0);
  const grandValue = csValue + faValue;
  const fmtGbp = (n: number) => "£" + n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ── Invoice basket ─────────────────────────────────────────────────────────
  type OrderItem = Product & { qtyOrdered: number; lineTotal: number };
  const mkOrderItems = (products: Product[]): OrderItem[] =>
    products
      .filter((p) => (qty[p.id] ?? 0) > 0)
      .map((p) => ({ ...p, qtyOrdered: qty[p.id] ?? 0, lineTotal: (qty[p.id] ?? 0) * p.unitCost }));
  const csOrderItems = mkOrderItems(visibleCs);
  const faOrderItems = mkOrderItems(visibleFa);
  const groupByCat = (items: OrderItem[]) =>
    items.reduce<Record<string, OrderItem[]>>((acc, item) => {
      (acc[item.category] ??= []).push(item);
      return acc;
    }, {});

  function renderInvoiceSection(label: string, items: OrderItem[], sectionValue: number, accentClass: string) {
    if (items.length === 0) return null;
    const cats = groupByCat(items);
    const sortedCats = Object.entries(cats).sort(([a], [b]) =>
      (CATEGORY_LABELS[a] ?? a).localeCompare(CATEGORY_LABELS[b] ?? b)
    );
    const multiCat = sortedCats.length > 1;
    return (
      <div className="px-4 py-3">
        <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${accentClass}`}>{label}</p>
        {sortedCats.map(([cat, catItems]) => (
          <div key={cat} className={multiCat ? "mb-3" : ""}>
            {multiCat && (
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1">
                {CATEGORY_LABELS[cat] ?? cat}
              </p>
            )}
            {catItems.map((item) => (
              <div key={item.id} className="flex items-baseline justify-between py-0.5 gap-2">
                <span className="text-xs text-gray-700 flex-1 min-w-0 truncate">
                  {item.name}{item.variant ? <span className="text-gray-400"> ({item.variant})</span> : ""}
                </span>
                <span className="text-xs text-gray-400 shrink-0">{item.qtyOrdered} × {fmtGbp(item.unitCost)}</span>
                <span className="text-xs font-semibold text-gray-800 tabular-nums w-16 text-right shrink-0">{fmtGbp(item.lineTotal)}</span>
              </div>
            ))}
          </div>
        ))}
        {(csOrderItems.length > 0 && faOrderItems.length > 0) && (
          <div className="flex justify-between border-t border-gray-100 pt-2 mt-1">
            <span className="text-xs text-gray-500">{label} subtotal</span>
            <span className="text-xs font-bold text-gray-700 tabular-nums">{fmtGbp(sectionValue)}</span>
          </div>
        )}
      </div>
    );
  }

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
    const inputEl = (
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
        className="h-10 w-10 sm:w-14 border-gray-300 text-center text-base font-bold tabular-nums text-gray-900 placeholder:text-gray-400 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none bg-white sm:border-x"
      />
    );
    return (
      <>
        {/* Mobile: vertical stack — + / qty / − */}
        <div className="flex sm:hidden flex-col items-center overflow-hidden rounded-xl border border-gray-300 w-10">
          <button type="button" onClick={() => adjust(p.id, 1)}
            className="flex h-9 w-full items-center justify-center text-xl font-light text-white bg-orange-500 transition-colors hover:bg-orange-400 active:bg-orange-600"
            aria-label="Increase">+</button>
          <div className="border-y border-gray-300 w-full flex items-center justify-center">{inputEl}</div>
          <button type="button" onClick={() => adjust(p.id, -1)} disabled={q === 0}
            className="flex h-9 w-full items-center justify-center text-xl font-light text-gray-600 bg-gray-100 transition-colors hover:bg-gray-200 active:bg-gray-300 disabled:opacity-25"
            aria-label="Decrease">−</button>
        </div>
        {/* Desktop: horizontal − / qty / + */}
        <div className="hidden sm:flex items-center overflow-hidden rounded-xl border border-gray-300">
          <button type="button" onClick={() => adjust(p.id, -1)} disabled={q === 0}
            className="flex h-10 w-10 items-center justify-center text-xl font-light text-gray-600 bg-gray-100 transition-colors hover:bg-gray-200 active:bg-gray-300 disabled:opacity-25"
            aria-label="Decrease">−</button>
          {inputEl}
          <button type="button" onClick={() => adjust(p.id, 1)}
            className="flex h-10 w-10 items-center justify-center text-xl font-light text-white bg-orange-500 transition-colors hover:bg-orange-400 active:bg-orange-600"
            aria-label="Increase">+</button>
        </div>
      </>
    );
  }

  function renderProductCard(p: Product) {
    const imgSrc = getImageSrc(p.imageUrl);
    const variantLabel = p.variant ?? "";
    const swatchColors = getSwatchColors(variantLabel);
    const ordered = (qty[p.id] ?? 0) > 0;
    return (
      <div key={p.id} className={`rounded-2xl border bg-white shadow-sm transition-colors ${ordered ? "border-orange-400 shadow-orange-100" : "border-gray-200"} ${bumped[p.id] ? "card-lift" : ""}`}>
        <div className="flex items-center gap-3 p-3 sm:gap-4 sm:p-4">
          <div className="relative shrink-0 group cursor-zoom-in">
            <div className="w-16 h-16 sm:w-24 sm:h-24 overflow-hidden rounded-xl bg-gray-50">
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
            <div className="flex items-center gap-1.5">
              {swatchColors.length > 0 && <ColourDot colors={swatchColors} />}
              <p className="text-sm sm:text-base font-bold leading-snug text-gray-900">{p.name}</p>
            </div>
            {variantLabel && <p className="mt-0.5 text-xs sm:text-sm text-gray-500">{variantLabel}</p>}
            {p.description && <p className="mt-0.5 text-xs italic text-gray-500 hidden sm:block">{p.description}</p>}
            <p className="mt-1 text-xs text-gray-600">£{p.unitCost.toFixed(2)} each</p>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
            {renderStepper(p)}
            <span className={`hidden sm:inline text-sm font-semibold text-green-600 w-16 text-right ${ordered ? "visible" : "invisible"}`}>= {fmtGbp((qty[p.id] ?? 0) * p.unitCost)}</span>
          </div>
        </div>
      </div>
    );
  }

  function renderProducts(products: Product[]) {
    const filtered = products
      .filter((p) => categoryFilter === "all" || (CATEGORY_PARENT[p.category] ?? p.category) === categoryFilter)
      .filter((p) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return p.name.toLowerCase().includes(q) || (p.variant ?? "").toLowerCase().includes(q);
      });

    // Group consecutive products with the same sectionLabel into sections
    type Item = { type: "standalone"; product: Product } | { type: "section"; label: string; products: Product[] };
    const items: Item[] = [];
    let i = 0;
    while (i < filtered.length) {
      const p = filtered[i];
      if (!p.sectionLabel) {
        items.push({ type: "standalone", product: p });
        i++;
      } else {
        const label = p.sectionLabel;
        const group: Product[] = [];
        while (i < filtered.length && filtered[i].sectionLabel === label) {
          group.push(filtered[i]);
          i++;
        }
        items.push({ type: "section", label, products: group });
      }
    }

    return (
      <div className="space-y-3">
        {items.map((item, idx) => {
          if (item.type === "standalone") {
            return renderProductCard(item.product);
          }
          const sectionOrdered = item.products.some((p) => (qty[p.id] ?? 0) > 0);
          const sectionDesc = item.products.find((p) => p.groupDescription)?.groupDescription ?? null;
          return (
            <div key={`section-${idx}`} className={`rounded-2xl border-2 overflow-hidden ${sectionOrdered ? "border-orange-300" : "border-gray-300"}`}>
              <div className={`px-4 py-3 border-b ${sectionOrdered ? "border-orange-200 bg-orange-50" : "border-gray-200 bg-gray-100"}`}>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{item.label}</p>
                {sectionDesc && <p className="mt-0.5 text-sm text-gray-600">{sectionDesc}</p>}
              </div>
              <div className="bg-white p-3 space-y-2">
                {item.products.map((p) => renderProductCard(p))}
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
          <div className="mx-auto max-w-6xl px-6 py-2.5 flex items-center justify-between gap-4">
            <p className="text-xs font-bold text-gray-900">
              {totalLines} item{totalLines !== 1 ? "s" : ""}
              {csLines > 0 && faLines > 0 && <span className="font-normal text-gray-500"> · CS {csLines} · FA {faLines}</span>}
            </p>
            <div className="text-right">
              <p className="text-sm font-bold text-orange-500">{fmtGbp(grandValue * 1.2)} <span className="font-normal text-xs">inc VAT</span></p>
              <p className="text-xs text-gray-400">{fmtGbp(grandValue)} ex VAT</p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mx-auto max-w-6xl px-6 py-8">

          {/* Header */}
          <div className="mb-8">
            <div className="mb-4">
              <Image src="/logo-horizontal.svg" alt="Xylo (UK) Ltd" width={160} height={40} priority />
            </div>
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
                  {groupType === "circuit" ? "Circuit name *" : "Regional name *"}
                </label>
                <input type="text" name="groupName" value={groupName} onChange={(e) => setGroupName(e.target.value)}
                  placeholder={groupType === "circuit" ? "e.g. North West 10B" : "e.g. Regional Name / Venue"}
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
                <input type="text" name="requiredByDate" value={requiredByDate}
                  onChange={(e) => setRequiredByDate(e.target.value)}
                  placeholder="DD/MM/YYYY"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-500 placeholder:text-gray-400" />
                <p className="mt-1 text-xs text-gray-400">Please place orders at least two weeks before the required date.</p>
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

          {/* Payment preference — Pay on Invoice only */}
          <div className="mb-5 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Payment</h2>
            <div className="flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 p-4">
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M12 2a10 10 0 100 20A10 10 0 0012 2z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-gray-900">Pay on Invoice</p>
                <p className="mt-0.5 text-xs text-gray-500">An invoice will be raised once your order is confirmed. No payment is taken now.</p>
              </div>
            </div>
            <input type="hidden" name="paymentMethod" value="po" />
          </div>

          {/* Two-column layout: product browser left, sticky basket right */}
          <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-8 lg:items-start">

            {/* ── Left: product browsing ── */}
            <div className="min-w-0">
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
                const activeProducts = activeTab === "CS" ? visibleCs : visibleFa;
                const cats = [...new Set(activeProducts.map(p => CATEGORY_PARENT[p.category] ?? p.category))];
                if (cats.length <= 1) return null;
                return (
                  <>
                    <div className="mb-1 flex flex-wrap gap-2">
                      <button type="button" onClick={() => setCategoryFilter("all")}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${categoryFilter === "all" ? "bg-orange-500 text-white" : "border border-gray-200 text-gray-500 hover:bg-gray-100"}`}>
                        All
                      </button>
                      {cats.map(cat => {
                        const catCount = activeProducts.filter(p => (CATEGORY_PARENT[p.category] ?? p.category) === cat && (qty[p.id] ?? 0) > 0).length;
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
              {(() => {
                let imgs: CarouselImage[] = [];
                if (categoryFilter !== "all") {
                  const activeProducts = activeTab === "CS" ? visibleCs : visibleFa;
                  const filtered = activeProducts.filter((p) => p.category === categoryFilter);
                  const seen = new Set<string>();
                  for (const p of filtered) {
                    const src = p.imageUrl ? getImageSrc(p.imageUrl) : null;
                    if (src && !seen.has(src)) { seen.add(src); imgs.push({ src, alt: p.name }); }
                    const gsrc = p.groupImageUrl ? getImageSrc(p.groupImageUrl) : null;
                    if (gsrc && !seen.has(gsrc)) { seen.add(gsrc); imgs.push({ src: gsrc, alt: p.name }); }
                  }
                }
                return <ProductCarousel images={imgs} animKey={`${activeTab}_${categoryFilter}`} />;
              })()}

              {/* Search */}
              <div className="mb-5 relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
                <input type="search" placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-9 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-orange-400 focus:outline-none" />
              </div>

              {/* Products */}
              {renderProducts(activeTab === "CS" ? visibleCs : visibleFa)}
            </div>

            {/* ── Right: sticky basket ── */}
            <div className="mt-8 lg:mt-0 lg:sticky lg:top-[72px]">
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">Order Summary</h2>
                  {totalLines > 0 && <span className="text-xs text-gray-400">{totalLines} item{totalLines !== 1 ? "s" : ""}</span>}
                </div>

                {/* CS / FA tab switcher — mirrors the left column tabs */}
                <div className="px-4 pt-3 pb-2 flex gap-2 border-b border-gray-100">
                  {(["CS", ...(hasFa ? ["FA"] : [])] as ("CS" | "FA")[]).map((tab) => {
                    const count = tab === "CS" ? csLines : faLines;
                    return (
                      <button key={tab} type="button"
                        onClick={() => { setActiveTab(tab); setCategoryFilter("all"); }}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${activeTab === tab ? "bg-gray-900 text-white" : "border border-gray-200 text-gray-500 hover:bg-gray-100"}`}>
                        {tab === "CS" ? "Cleaning" : "First Aid"}
                        {count > 0 && (
                          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${activeTab === tab ? "bg-white text-gray-900" : "bg-gray-200 text-gray-600"}`}>{count}</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {totalLines === 0 ? (
                  <p className="px-4 py-5 text-sm text-gray-400">No items added yet — select products to the left.</p>
                ) : (
                  <div className="divide-y divide-gray-100 max-h-[55vh] overflow-y-auto">
                    {renderInvoiceSection("Cleaning Supplies", csOrderItems, csValue, "text-orange-400")}
                    {renderInvoiceSection("First Aid", faOrderItems, faValue, "text-blue-400")}
                  </div>
                )}

                {/* VAT breakdown — always visible */}
                {totalLines > 0 && (
                  <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-500">Subtotal (ex VAT)</span>
                      <span className="text-xs text-gray-700 tabular-nums">{fmtGbp(grandValue)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-500">VAT (20%)</span>
                      <span className="text-xs text-gray-700 tabular-nums">{fmtGbp(grandValue * 0.2)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-gray-200">
                      <span className="text-sm font-bold text-gray-900">Total (inc VAT)</span>
                      <span className="text-sm font-bold text-orange-500 tabular-nums">{fmtGbp(grandValue * 1.2)}</span>
                    </div>
                  </div>
                )}

                <div className="px-4 py-4 border-t border-gray-100">
                  {!canSubmit && totalLines === 0 && (
                    <p className="mb-3 text-xs text-gray-400">Fill in your details and add items to continue.</p>
                  )}
                  <button type="submit" disabled={!canSubmit || isPending}
                    className="w-full rounded-xl bg-orange-500 py-3 text-sm font-bold text-white hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    {isPending ? "Submitting…" : "Submit order"}
                  </button>
                </div>
              </div>

              <p className="mt-3 text-center text-xs text-gray-400">
                You&apos;ll receive a confirmation email once your order is submitted.
              </p>
            </div>

          </div>{/* end two-column grid */}
        </div>
      </form>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-8">
        <div className="mx-auto max-w-6xl px-6 py-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-between sm:items-start">
          <Image src="/logo-horizontal.svg" alt="Xylo (UK) Ltd" width={120} height={30} />
          <div className="text-center sm:text-right">
            <p className="text-xs text-gray-500 leading-relaxed">
              R08 Regent Works Studio, Regent Works, Lawley Street, Longton, Staffs. ST3 1LZ
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Co. Reg: GB:073 23863 &nbsp;&middot;&nbsp; VAT Reg No: 442 8892 61
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
