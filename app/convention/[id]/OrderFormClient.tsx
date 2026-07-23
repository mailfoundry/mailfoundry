"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { saveOrderItem, saveConventionDetails, confirmOrder } from "../actions";

import { getImageSrc } from "../../../src/lib/image-utils";

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

type Convention = {
  id: string;
  name: string;
  venue: string | null;
  conventionDate: string;
  deliveryDate: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactMobile: string | null;
  cleaningOverseerName: string | null;
  cleaningOverseerEmail: string | null;
  cleaningOverseerMobile: string | null;
  deliveryAddress: string | null;
  deliveryContactName: string | null;
  deliveryContactEmail: string | null;
  deliveryContactMobile: string | null;
  isLocked: boolean;
  isFaLocked: boolean;
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

// Strip the last size/pack suffix from a product code to get its family key.
// Stripping only ONE level keeps colour in the key (HI_VIS_PINK, not HI_VIS).
const _SIZE_RE   = /_(S|M|L|XL|XXL|SML|MED|SMALL|MEDIUM|LARGE|XLARGE)$/i;
const _COLOUR_RE = /_(RED|BLUE|GREEN|YELLOW|WHITE|PINK|CLEAR|BLACK|ORANGE)$/i;
const _PACK_RE   = /_(\d+PK|X\d+|\d+PACK)$/i;
const _VOLUME_RE = /_\d+L$/i;  // e.g. _10L, _20L, _50L

const SIZE_RANK: Record<string, number> = {
  S: 0, SML: 0, SMALL: 0,
  M: 1, MED: 1, MEDIUM: 1,
  L: 2, LARGE: 2,
  XL: 3, XLARGE: 3,
  XXL: 4, XXLARGE: 4,
};

function getSizeRank(code: string): number {
  const m = code.match(/_(S|M|L|XL|XXL|SML|MED|SMALL|MEDIUM|LARGE|XLARGE|XXLARGE)(?:_\d+PACK)?$/i);
  return m ? (SIZE_RANK[m[1].toUpperCase()] ?? 99) : 99;
}

function getCodeFamily(code: string): string {
  // Space-delimited codes use " - COLOUR" as variant suffix
  // e.g. "BROOM HEAD WASHABLE 45CM SOFT - BLUE" → "BROOM HEAD WASHABLE 45CM SOFT"
  const dashIdx = code.lastIndexOf(" - ");
  if (dashIdx > -1) return code.slice(0, dashIdx);

  // 1. Strip pack suffix first, then size → covers e.g. GLOVES_NITRILE-POLY_FOAM_S_10PACK
  const afterPack = code.replace(_PACK_RE, "");
  const afterSize = afterPack.replace(_SIZE_RE, "");
  if (afterSize !== afterPack) return afterSize; // had a size → done (keeps colour)

  // 2. Volume suffix (e.g. SPILL_KITS_MAINTENANCE_10L → SPILL_KITS_MAINTENANCE)
  const afterVolume = afterPack.replace(_VOLUME_RE, "");
  if (afterVolume !== afterPack) return afterVolume;

  // 3. No size/volume suffix → strip colour from the pack-stripped version
  // (handles CLOTH_MFIBRE_BLUE_10PK → CLOTH_MFIBRE_BLUE → CLOTH_MFIBRE)
  const afterColour = afterPack.replace(_COLOUR_RE, "");
  if (afterColour !== afterPack) return afterColour;

  // 4. Only a pack suffix (no size/colour/volume) — still group them together
  if (afterPack !== code) return afterPack;

  return code;
}

// Colour swatch map — used to render a dot next to colour-variant rows
const COLOUR_SWATCHES: Record<string, string> = {
  yellow:  "#EAB308",
  orange:  "#F97316",
  red:     "#EF4444",
  pink:    "#EC4899",
  blue:    "#3B82F6",
  green:   "#22C55E",
  white:   "#F1F5F9",
  black:   "#334155",
  clear:   "#94A3B8",
  grey:    "#6B7280",
  gray:    "#6B7280",
  navy:    "#1E3A5F",
  purple:  "#A855F7",
};

// Return ALL colours found in a label/description (order of first appearance)
function getSwatchColors(label: string): string[] {
  const lower = label.toLowerCase();
  const found: string[] = [];
  for (const [name, hex] of Object.entries(COLOUR_SWATCHES)) {
    if (lower.includes(name) && !found.includes(hex)) found.push(hex);
  }
  return found;
}

// Render a colour dot: single solid colour, or left/right halves for two colours
function ColourDot({ colors }: { colors: string[] }) {
  if (colors.length === 0) return <span className="inline-block h-4 w-4 shrink-0" />;
  const style =
    colors.length === 1
      ? { backgroundColor: colors[0] }
      : { background: `linear-gradient(90deg, ${colors[0]} 50%, ${colors[1]} 50%)` };
  return (
    <span
      className="inline-block h-4 w-4 shrink-0 rounded-full border border-white/15 shadow-sm"
      style={style}
    />
  );
}

// If a size label is the full product description ("Product Name - Yellow"),
// collapse it to just the trailing colour/size token ("Yellow").
function shortenLabel(label: string): string {
  const dashIdx = label.lastIndexOf(" - ");
  if (dashIdx > 10) return label.slice(dashIdx + 3).trim();
  return label;
}

function Field({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-400">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-600 bg-slate-700 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
      />
    </div>
  );
}

export default function OrderFormClient({ convention, csProducts, faProducts, existingQty }: Props) {
  const hasFa = faProducts.length > 0;

  // Local confirmed state — updates immediately on confirm without waiting for server re-render
  const [csConfirmed, setCsConfirmed] = useState(convention.isLocked);
  const [faConfirmed, setFaConfirmed] = useState(convention.isFaLocked);

  // Start at first unconfirmed section
  const [activeTab, setActiveTab] = useState<"CS" | "FA" | "details">(() => {
    if (!convention.isLocked) return "CS";
    if (!convention.isFaLocked && hasFa) return "FA";
    return "details";
  });

  const [allDone, setAllDone] = useState(false);
  const [search, setSearch] = useState("");
  const [detailsDraft, setDetailsDraft] = useState({
    name:                  convention.name,
    conventionDate:        convention.conventionDate.slice(0, 10),
    deliveryDate:          convention.deliveryDate?.slice(0, 10) ?? "",
    contactName:           convention.contactName ?? "",
    contactEmail:          convention.contactEmail ?? "",
    contactMobile:         convention.contactMobile ?? "",
    cleaningOverseerName:  convention.cleaningOverseerName ?? "",
    cleaningOverseerEmail: convention.cleaningOverseerEmail ?? "",
    cleaningOverseerMobile:convention.cleaningOverseerMobile ?? "",
    deliveryAddress:       convention.deliveryAddress ?? "",
    deliveryContactName:   convention.deliveryContactName ?? "",
    deliveryContactEmail:  convention.deliveryContactEmail ?? "",
    deliveryContactMobile: convention.deliveryContactMobile ?? "",
  });
  const [isSavingDetails, startSavingDetails] = useTransition();
  const [detailsSaved, setDetailsSaved] = useState(false);
  const [isConfirming, startConfirming] = useTransition();
  const [qty, setQty] = useState<Record<string, number>>(existingQty);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved]   = useState<Record<string, boolean>>({});
  const [bumped, setBumped] = useState<Record<string, boolean>>({});
  const [, startTransition] = useTransition();

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const tabLocked = activeTab === "FA" ? faConfirmed : csConfirmed;

  function handleConfirm() {
    const dept = activeTab as "CS" | "FA";
    if (!window.confirm(
      `Are you happy that the ${dept === "FA" ? "First Aid" : "Cleaning Supplies"} section is correct?\n\nOnce confirmed you won't be able to make further changes to this section.`
    )) return;
    const fd = new FormData();
    fd.set("conventionId", convention.id);
    fd.set("dept", dept);
    startConfirming(async () => {
      await confirmOrder(fd);
      if (dept === "CS") {
        setCsConfirmed(true);
        setActiveTab(hasFa ? "FA" : "details");
      } else {
        setFaConfirmed(true);
        setActiveTab("details");
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function save(productId: string, dept: "CS" | "FA", n: number) {
    if (dept === "FA" ? faConfirmed : csConfirmed) return;
    setSaving((prev) => ({ ...prev, [productId]: true }));
    setSaved((prev)   => ({ ...prev, [productId]: false }));
    const fd = new FormData();
    fd.set("conventionId", convention.id);
    fd.set("productId", productId);
    fd.set("dept", dept);
    fd.set("qty", String(n));
    startTransition(async () => {
      await saveOrderItem(fd);
      setSaving((prev) => ({ ...prev, [productId]: false }));
      setSaved((prev)  => ({ ...prev, [productId]: true }));
      setTimeout(() => setSaved((prev) => ({ ...prev, [productId]: false })), 2000);
    });
  }

  function adjust(productId: string, dept: "CS" | "FA", delta: number) {
    if (dept === "FA" ? faConfirmed : csConfirmed) return;
    const current = qty[productId] ?? 0;
    const next = Math.max(0, current + delta);
    if (next === current) return;
    setQty((prev) => ({ ...prev, [productId]: next }));
    save(productId, dept, next);
    // Trigger lift animation
    setBumped((prev) => ({ ...prev, [productId]: true }));
    setTimeout(() => setBumped((prev) => ({ ...prev, [productId]: false })), 400);
  }

  function renderStepper(p: Product, dept: "CS" | "FA") {
    const q = qty[p.id] ?? 0;
    const isSaving = saving[p.id];
    const isSaved  = saved[p.id];

    const locked = dept === "FA" ? faConfirmed : csConfirmed;
    if (locked) {
      return (
        <span className={`text-sm font-bold ${q > 0 ? "text-white" : "text-slate-700"}`}>{q}</span>
      );
    }
    return (
      <div className="flex items-center overflow-hidden rounded-xl border border-slate-600">
        <button
          onClick={() => adjust(p.id, dept, -1)}
          disabled={q === 0 || isSaving}
          className="flex h-10 w-10 items-center justify-center text-xl font-light text-slate-300 bg-slate-800 transition-colors hover:bg-slate-700 active:bg-slate-600 disabled:opacity-25"
          aria-label="Decrease"
        >
          −
        </button>
        <div className={`flex h-10 min-w-[2.75rem] items-center justify-center border-x border-slate-600 px-1 text-base font-bold tabular-nums ${
          isSaved ? "text-green-400" : q > 0 ? "text-white" : "text-slate-500"
        }`}>
          {isSaving ? <span className="text-xs text-slate-500">…</span> : q}
        </div>
        <button
          onClick={() => adjust(p.id, dept, 1)}
          disabled={isSaving}
          className="flex h-10 w-10 items-center justify-center text-xl font-light text-white bg-orange-500 transition-colors hover:bg-orange-400 active:bg-orange-600 disabled:opacity-40"
          aria-label="Increase"
        >
          +
        </button>
      </div>
    );
  }

  function renderProducts(products: Product[], dept: "CS" | "FA") {
    const byCat = products.reduce<Record<string, Product[]>>((acc, p) => {
      (acc[p.category] ??= []).push(p);
      return acc;
    }, {});

    return (
      <div className="space-y-8">
        {Object.entries(byCat).map(([cat, items]) => {
          // Group items: products with groupWithVariants=true share a card by name;
          // others each get their own card.
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
                    // ── Single-variant card ───────────────────────────────────
                    const p = first;
                    const variantLabel = p.variant ?? "";
                    const swatchColors = getSwatchColors(variantLabel);
                    const ordered = (qty[p.id] ?? 0) > 0;
                    return (
                      <div
                        key={p.id}
                        className={`overflow-hidden rounded-2xl border bg-slate-800 shadow-lg shadow-black/30 transition-colors ${
                          ordered ? "border-orange-500/60 shadow-orange-900/20" : "border-slate-600"
                        } ${bumped[p.id] ? "card-lift" : ""}`}
                      >
                        <div className="flex items-center gap-4 p-4">
                          <div className="w-24 h-24 shrink-0 overflow-hidden rounded-xl bg-slate-800">
                            {imgSrc ? (
                              <Image src={imgSrc} alt={p.name} width={96} height={96} className="h-full w-full object-contain" />
                            ) : (
                              <div className="h-full w-full" />
                            )}
                          </div>
                          {/* Centre: name, variant, price */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              {swatchColors.length > 0 && <ColourDot colors={swatchColors} />}
                              <p className="text-base font-bold leading-snug text-white">{p.name}</p>
                            </div>
                            {variantLabel && <p className="mt-0.5 text-sm text-slate-400">{variantLabel}</p>}
                            {p.description && <p className="mt-0.5 text-xs italic text-slate-400">{p.description}</p>}
                            <p className="mt-1 text-xs text-slate-500">£{p.unitCost.toFixed(2)} each</p>
                          </div>
                          {/* Right: stepper + running total */}
                          <div className="shrink-0 flex items-center gap-2">
                            {renderStepper(p, dept)}
                            <span className={`text-sm font-semibold text-green-500 w-16 text-right ${ordered ? "visible" : "invisible"}`}>= £{((qty[p.id] ?? 0) * p.unitCost).toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // ── Grouped card (multiple variants) ─────────────────────
                  const anyOrdered = group.some((p) => (qty[p.id] ?? 0) > 0);
                  const anyBumped  = group.some((p) => bumped[p.id]);
                  return (
                    <div
                      key={getCodeFamily(first.code)}
                      className={`overflow-hidden rounded-2xl border bg-slate-800 shadow-lg shadow-black/30 transition-colors ${
                        anyOrdered ? "border-orange-500/60 shadow-orange-900/20" : "border-slate-600"
                      } ${anyBumped ? "card-lift" : ""}`}
                    >
                      {/* Group header — shared image + product name */}
                      <div className="flex gap-4 px-4 pt-4 pb-3 items-center">
                        <div className="w-16 h-16 shrink-0 overflow-hidden rounded-xl bg-slate-800">
                          {imgSrc ? (
                            <Image src={imgSrc} alt={first.name} width={64} height={64} className="h-full w-full object-contain" />
                          ) : (
                            <div className="h-full w-full" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-base font-bold leading-snug text-white">{first.name}</p>
                          {group.find(p => p.groupDescription)?.groupDescription && <p className="mt-0.5 text-xs italic text-slate-400">{group.find(p => p.groupDescription)?.groupDescription}</p>}
                        </div>
                      </div>

                      {/* Variant rows — each with its own image */}
                      <div className="border-t border-slate-700 divide-y divide-slate-700/60">
                        {[...group].sort((a, b) => {
                          const SIZE_ORDER: Record<string, number> = { small: 0, s: 0, medium: 1, m: 1, large: 2, l: 2, "x-large": 3, xlarge: 3, xl: 3, "xx-large": 4, xxlarge: 4, xxl: 4, "xxx-large": 5, xxxlarge: 5, xxxl: 5 };
                          const getSize = (v: string | null) => { const k = (v ?? "").toLowerCase().trim(); return SIZE_ORDER[k] ?? 99; };
                          const getWeight = (v: string | null) => { const m = (v ?? "").match(/(\d+)\s*g/i); return m ? parseInt(m[1]) : 0; };
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
                              {/* Per-variant image */}
                              <div className="w-14 h-14 shrink-0 overflow-hidden rounded-lg bg-slate-800">
                                {variantImgSrc ? (
                                  <Image src={variantImgSrc} alt={variantLabel || p.name} width={56} height={56} className="h-full w-full object-contain" />
                                ) : (
                                  <div className="h-full w-full" />
                                )}
                              </div>
                              {swatchColors.length > 0
                                ? <ColourDot colors={swatchColors} />
                                : <span className="w-4 shrink-0" />
                              }
                              <div className="min-w-0 flex-1">
                                <p className="text-sm text-slate-300">{variantLabel || p.name}</p>
                                <p className="text-xs text-slate-500">£{p.unitCost.toFixed(2)} each</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {renderStepper(p, dept)}
                                <span className={`text-sm font-semibold text-green-500 w-16 text-right ${ordered ? "visible" : "invisible"}`}>= £{((qty[p.id] ?? 0) * p.unitCost).toFixed(2)}</span>
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

  const totalValue = (products: Product[]) =>
    products.reduce((s, p) => s + (qty[p.id] ?? 0) * p.unitCost, 0);

  const totalLines = (products: Product[]) =>
    products.filter((p) => (qty[p.id] ?? 0) > 0).length;

  const allActiveProducts = activeTab === "CS" ? csProducts : faProducts;
  const activeProducts = search.trim()
    ? allActiveProducts.filter((p) => {
        const q = search.toLowerCase();
        return p.name.toLowerCase().includes(q) || (p.variant ?? "").toLowerCase().includes(q);
      })
    : allActiveProducts;

  const csLines = totalLines(csProducts);
  const faLines = totalLines(faProducts);
  const csValue = totalValue(csProducts);
  const faValue = totalValue(faProducts);
  const grandLines = csLines + faLines;
  const grandValue = csValue + faValue;

  const fmtGbp = (n: number) =>
    "£" + n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

      {/* ── Sticky summary bar ──────────────────────────────────────────── */}
      {grandLines > 0 && (
        <div className="sticky top-0 z-30 bg-slate-800/95 backdrop-blur-md shadow-lg shadow-black/40 border-b border-slate-700">
          <div className="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between gap-4">
            {/* Left: convention + breakdown */}
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-white">
                {convention.name}
                <span className="ml-2 font-normal text-slate-400">
                  · {grandLines} line{grandLines !== 1 ? "s" : ""}
                  {csLines > 0 && faLines > 0 && <> (CS&nbsp;{csLines} · FA&nbsp;{faLines})</>}
                </span>
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                Ex VAT <span className="font-semibold text-slate-200">{fmtGbp(grandValue)}</span>
                <span className="mx-2 text-slate-600">+</span>
                VAT <span className="font-semibold text-slate-200">{fmtGbp(grandValue * 0.2)}</span>
              </p>
            </div>
            {/* Right: total */}
            <div className="shrink-0 text-right">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Total inc. VAT</p>
              <p className="text-xl font-bold text-green-400">{fmtGbp(grandValue * 1.2)}</p>
            </div>
          </div>
        </div>
      )}

      {allDone && (
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <div className="mb-6 flex justify-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-green-600 text-3xl">✓</span>
          </div>
          <h1 className="text-2xl font-bold text-white">All done — thank you!</h1>
          <p className="mt-3 text-sm text-slate-400">
            Your order review is complete. Xylo (UK) Ltd will be in touch if there&apos;s anything to follow up on.
          </p>
        </div>
      )}

      {!allDone && <div className="mx-auto max-w-3xl px-4 py-8">

        {/* Header */}
        <div className="mb-6">
          <p className="text-sm font-semibold text-orange-500">IBSA · Xylo (UK) Ltd</p>
          <h1 className="mt-1 text-2xl font-bold text-white">{convention.name}{convention.venue ? ` (${convention.venue})` : ""}</h1>
          <p className="mt-1 text-sm text-slate-500">{fmtDate(convention.conventionDate)}</p>
        </div>

        {/* Step progress bar */}
        {(() => {
          const steps = [
            { key: "CS", label: "Cleaning Supplies", confirmed: csConfirmed },
            ...(hasFa ? [{ key: "FA", label: "First Aid", confirmed: faConfirmed }] : []),
            { key: "details", label: "Your Details", confirmed: false },
          ];
          return (
            <div className="mb-6 flex items-center gap-0">
              {steps.map((step, i) => {
                const isActive = activeTab === step.key;
                return (
                  <div key={step.key} className="flex items-center flex-1 min-w-0">
                    <button
                      onClick={() => setActiveTab(step.key as "CS" | "FA" | "details")}
                      className={`flex flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-center transition-colors ${
                        isActive ? "bg-slate-700" : "hover:bg-slate-800/60"
                      }`}
                    >
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                        step.confirmed
                          ? "bg-green-600 text-white"
                          : isActive
                          ? "bg-white text-slate-900"
                          : "border border-slate-600 text-slate-500"
                      }`}>
                        {step.confirmed ? "✓" : i + 1}
                      </span>
                      <span className={`text-xs font-semibold leading-tight ${
                        step.confirmed ? "text-green-400" : isActive ? "text-white" : "text-slate-500"
                      }`}>
                        {step.label}
                      </span>
                    </button>
                    {i < steps.length - 1 && (
                      <div className={`h-px w-4 shrink-0 ${csConfirmed && i === 0 ? "bg-green-700" : "bg-slate-700"}`} />
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Per-tab banner */}
        {activeTab !== "details" && (
          tabLocked ? (
            <div className="mb-6 rounded-xl border border-green-800/40 bg-green-950/20 px-4 py-3 text-sm text-green-400">
              ✓ Your {activeTab === "FA" ? "First Aid" : "Cleaning Supplies"} order has been confirmed.
              {activeTab === "CS" && hasFa && " Please now review the First Aid section."}
              {" "}Contact Xylo (UK) Ltd if you need to amend anything.
            </div>
          ) : (
            <div className="mb-6 rounded-xl border border-blue-800/40 bg-blue-950/20 px-4 py-3 text-sm text-blue-300">
              {activeTab === "CS"
                ? hasFa
                  ? "Please check your Cleaning Supplies quantities are correct, then confirm. You'll then be taken to the First Aid section."
                  : "Please check your Cleaning Supplies quantities are correct, then confirm."
                : "Please check your First Aid quantities are correct, then confirm. You'll then be asked to verify your contact details."}
            </div>
          )
        )}

        {activeTab === "details" && (
          <div className="mb-6 rounded-xl border border-blue-800/40 bg-blue-950/20 px-4 py-3 text-sm text-blue-300">
            Please check your contact and delivery details are correct and save any changes.
          </div>
        )}

        {activeTab === "details" ? (
          /* ── Details tab ──────────────────────────────────────────────── */
          <div className="space-y-6">

            {/* Convention */}
            <div className="rounded-2xl border border-slate-700 bg-slate-800 p-5">
              <p className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">Convention</p>
              <div className="space-y-3">
                <Field label="Convention name" value={detailsDraft.name} onChange={(v) => setDetailsDraft((d) => ({ ...d, name: v }))} placeholder="e.g. Wembley Convention 2026" />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Convention date" type="date" value={detailsDraft.conventionDate} onChange={(v) => setDetailsDraft((d) => ({ ...d, conventionDate: v }))} />
                  <Field label="Delivery date" type="date" value={detailsDraft.deliveryDate} onChange={(v) => setDetailsDraft((d) => ({ ...d, deliveryDate: v }))} />
                </div>
              </div>
            </div>

            {/* Convention overseer */}
            <div className="rounded-2xl border border-slate-700 bg-slate-800 p-5">
              <p className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">Convention Overseer</p>
              <div className="space-y-3">
                <Field label="Name" value={detailsDraft.contactName} onChange={(v) => setDetailsDraft((d) => ({ ...d, contactName: v }))} placeholder="Full name" />
                <Field label="Email" type="email" value={detailsDraft.contactEmail} onChange={(v) => setDetailsDraft((d) => ({ ...d, contactEmail: v }))} placeholder="email@example.com" />
                <Field label="Mobile" type="tel" value={detailsDraft.contactMobile} onChange={(v) => setDetailsDraft((d) => ({ ...d, contactMobile: v }))} placeholder="+44 7700 000000" />
              </div>
            </div>

            {/* Cleaning overseer */}
            <div className="rounded-2xl border border-slate-700 bg-slate-800 p-5">
              <p className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">Cleaning Overseer</p>
              <div className="space-y-3">
                <Field label="Name" value={detailsDraft.cleaningOverseerName} onChange={(v) => setDetailsDraft((d) => ({ ...d, cleaningOverseerName: v }))} placeholder="Full name" />
                <Field label="Email" type="email" value={detailsDraft.cleaningOverseerEmail} onChange={(v) => setDetailsDraft((d) => ({ ...d, cleaningOverseerEmail: v }))} placeholder="email@example.com" />
                <Field label="Mobile" type="tel" value={detailsDraft.cleaningOverseerMobile} onChange={(v) => setDetailsDraft((d) => ({ ...d, cleaningOverseerMobile: v }))} placeholder="+44 7700 000000" />
              </div>
            </div>

            {/* Delivery */}
            <div className="rounded-2xl border border-slate-700 bg-slate-800 p-5">
              <p className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">Delivery</p>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">Delivery address</label>
                  <textarea
                    rows={3}
                    value={detailsDraft.deliveryAddress}
                    onChange={(e) => setDetailsDraft((d) => ({ ...d, deliveryAddress: e.target.value }))}
                    placeholder={"Venue name\nStreet address\nCity, Postcode"}
                    className="w-full rounded-xl border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none resize-none"
                  />
                </div>
                <Field label="Contact name" value={detailsDraft.deliveryContactName} onChange={(v) => setDetailsDraft((d) => ({ ...d, deliveryContactName: v }))} placeholder="Person receiving the order" />
                <Field label="Contact email" type="email" value={detailsDraft.deliveryContactEmail} onChange={(v) => setDetailsDraft((d) => ({ ...d, deliveryContactEmail: v }))} placeholder="email@example.com" />
                <Field label="Contact mobile" type="tel" value={detailsDraft.deliveryContactMobile} onChange={(v) => setDetailsDraft((d) => ({ ...d, deliveryContactMobile: v }))} placeholder="+44 7700 000000" />
              </div>
            </div>

            {/* Save button — always available; details are independent of order confirmation */}
            <button
                onClick={() => {
                  const fd = new FormData();
                  fd.set("conventionId", convention.id);
                  Object.entries(detailsDraft).forEach(([k, v]) => fd.set(k, v));
                  startSavingDetails(async () => {
                    await saveConventionDetails(fd);
                    setDetailsSaved(true);
                    setTimeout(() => setDetailsSaved(false), 2500);
                  });
                }}
                disabled={isSavingDetails}
                className="w-full rounded-xl bg-orange-500 py-3 text-sm font-bold text-white transition-colors hover:bg-orange-400 disabled:opacity-50"
              >
                {isSavingDetails ? "Saving…" : detailsSaved ? "✓ Saved" : "Save details"}
            </button>

            {/* Green confirm button — marks the whole form as complete */}
            <button
              type="button"
              onClick={() => {
                if (!window.confirm("Are you happy that all details are correct?\n\nThis will complete your order review.")) return;
                setAllDone(true);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="w-full rounded-xl bg-green-600 py-4 text-sm font-bold text-white transition-colors hover:bg-green-500"
            >
              ✓ Details are correct — all done
            </button>
          </div>
        ) : (
          <>
            {/* Search */}
            <div className="mb-5 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <input
                type="search"
                placeholder="Search products…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2.5 pl-9 pr-4 text-sm text-white placeholder-slate-500 focus:border-slate-500 focus:outline-none"
              />
            </div>

            {/* Product list */}
            {activeProducts.length === 0 && search.trim() ? (
              <p className="py-12 text-center text-sm text-slate-500">No products match &ldquo;{search}&rdquo;</p>
            ) : (
              renderProducts(activeProducts, activeTab as "CS" | "FA")
            )}

            {/* Footer note + confirm button */}
            {!tabLocked && (
              <div className="mt-10 space-y-4">
                <p className="text-center text-xs text-slate-600">
                  Please check the quantities match your original order. Any changes save automatically — contact Xylo (UK) Ltd if you have questions.
                </p>
                {/* Show confirm button only on the tab that has items */}
                {((activeTab === "CS" && csLines > 0) || (activeTab === "FA" && faLines > 0)) && (
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={isConfirming}
                    className="w-full rounded-xl bg-green-600 py-4 text-sm font-bold text-white transition-colors hover:bg-green-500 disabled:opacity-50"
                  >
                    {isConfirming
                      ? "Confirming…"
                      : `✓ ${activeTab === "FA" ? "First Aid" : "Cleaning Supplies"} order is correct — Confirm`}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>}
    </main>
  );
}
