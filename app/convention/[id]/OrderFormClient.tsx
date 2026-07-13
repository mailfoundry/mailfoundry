"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { saveOrderItem } from "../actions";
import { PRODUCT_IMAGE_MAP } from "../../../src/lib/product-images";
import { PRODUCT_DESCRIPTION_MAP, PRODUCT_SIZE_MAP } from "../../../src/lib/product-descriptions";

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

// Strip the last size/pack suffix from a product code to get its family key.
// Stripping only ONE level keeps colour in the key (HI_VIS_PINK, not HI_VIS).
const _SIZE_RE   = /_(S|M|L|XL|XXL|SML|MED|SMALL|MEDIUM|LARGE|XLARGE)$/i;
const _COLOUR_RE = /_(RED|BLUE|GREEN|YELLOW|WHITE|PINK|CLEAR|BLACK|ORANGE)$/i;
const _PACK_RE   = /_(\d+PK|X\d+|\d+PACK)$/i;

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

  // 2. No size suffix → strip colour from the pack-stripped version
  // (handles CLOTH_MFIBRE_BLUE_10PK → CLOTH_MFIBRE_BLUE → CLOTH_MFIBRE)
  const afterColour = afterPack.replace(_COLOUR_RE, "");
  if (afterColour !== afterPack) return afterColour;

  // 3. Only a pack suffix (no size/colour) — still group them together
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
    if (convention.isLocked) return;
    const current = qty[productId] ?? 0;
    const next = Math.max(0, current + delta);
    if (next === current) return;
    setQty((prev) => ({ ...prev, [productId]: next }));
    save(productId, dept, next);
  }

  function renderStepper(p: Product, dept: "CS" | "FA") {
    const q = qty[p.id] ?? 0;
    const isSaving = saving[p.id];
    const isSaved  = saved[p.id];

    if (convention.isLocked) {
      return (
        <span className={`text-sm font-bold ${q > 0 ? "text-white" : "text-slate-700"}`}>{q}</span>
      );
    }
    return (
      <div className="flex items-center overflow-hidden rounded-xl border border-slate-700">
        <button
          onClick={() => adjust(p.id, dept, -1)}
          disabled={q === 0 || isSaving}
          className="flex h-10 w-10 items-center justify-center text-lg text-slate-400 transition-colors hover:bg-slate-800 active:bg-slate-700 disabled:opacity-30"
          aria-label="Decrease"
        >
          −
        </button>
        <div className={`flex h-10 min-w-[2.75rem] items-center justify-center border-x border-slate-700 px-1 text-sm font-bold tabular-nums ${
          isSaved ? "text-green-400" : q > 0 ? "text-white" : "text-slate-600"
        }`}>
          {isSaving ? <span className="text-xs text-slate-500">…</span> : q}
        </div>
        <button
          onClick={() => adjust(p.id, dept, 1)}
          disabled={isSaving}
          className="flex h-10 w-10 items-center justify-center text-lg text-slate-400 transition-colors hover:bg-slate-800 active:bg-slate-700 disabled:opacity-30"
          aria-label="Increase"
        >
          +
        </button>
      </div>
    );
  }

  function renderProducts(products: Product[], dept: "CS" | "FA") {
    // Group by category, then by product name within each category
    const byCat = products.reduce<Record<string, Product[]>>((acc, p) => {
      (acc[p.category] ??= []).push(p);
      return acc;
    }, {});

    return (
      <div className="space-y-8">
        {Object.entries(byCat).map(([cat, catItems]) => {
          // Group variants by code family (strip only the final size/pack suffix,
          // keeping colour in the key so e.g. HI_VIS_PINK and HI_VIS_YELLOW stay separate)
          const byName: Record<string, Product[]> = {};
          for (const p of catItems) {
            (byName[getCodeFamily(p.code)] ??= []).push(p);
          }
          // Sort variants within each group: S → M → L → XL → XXL
          for (const variants of Object.values(byName)) {
            variants.sort((a, b) => getSizeRank(a.code) - getSizeRank(b.code));
          }

          return (
            <div key={cat}>
              <p className="mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {CATEGORY_LABELS[cat] ?? cat}
              </p>
              <div className="space-y-3">
                {Object.entries(byName).map(([groupKey, variants]) => {
                  // Pick the code that has an image as the representative
                  const repCode = variants.find((v) => PRODUCT_IMAGE_MAP[v.code])?.code ?? variants[0].code;
                  const imgSrc = PRODUCT_IMAGE_MAP[repCode] ?? null;
                  // Prefer the full Excel description; fall back to the DB name field
                  const description = PRODUCT_DESCRIPTION_MAP[repCode] ?? variants[0].name;
                  // Colours derived from the product description (used as fallback on size rows)
                  const groupColors = getSwatchColors(description);
                  const hasVariants = variants.length > 1;
                  const allSamePrice = variants.every((v) => v.unitCost === variants[0].unitCost);
                  const groupOrdered = variants.some((v) => (qty[v.id] ?? 0) > 0);

                  return (
                    <div
                      key={groupKey}
                      className={`overflow-hidden rounded-2xl border bg-slate-900 transition-colors ${
                        groupOrdered ? "border-green-800/40" : "border-slate-800"
                      }`}
                    >
                      {/* ── Product header ──────────────────────────── */}
                      <div className="flex gap-4 p-4">
                        {/* Image — larger, shared across variants */}
                        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-800">
                          {imgSrc ? (
                            <Image
                              src={imgSrc}
                              alt={description}
                              width={80}
                              height={80}
                              className="h-full w-full object-contain p-1"
                            />
                          ) : (
                            <div className="h-full w-full" />
                          )}
                        </div>

                        {/* Description + price */}
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold leading-snug text-white">{description}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {allSamePrice
                              ? `£${variants[0].unitCost.toFixed(2)} each`
                              : "Prices vary by size"}
                          </p>

                          {/* Single-item stepper inline in header */}
                          {!hasVariants && (
                            <div className="mt-3 flex items-center gap-2">
                              {renderStepper(variants[0], dept)}
                              {(qty[variants[0].id] ?? 0) > 0 && (
                                <span className="text-xs text-green-500">
                                  = £{((qty[variants[0].id] ?? 0) * variants[0].unitCost).toFixed(2)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* ── Variant rows ─────────────────────────────── */}
                      {hasVariants && (
                        <div className="border-t border-slate-800">
                          {variants.map((p, i) => {
                            const q = qty[p.id] ?? 0;
                            const rawLabel = PRODUCT_SIZE_MAP[p.code] ?? p.variant ?? "";
                            const sizeLabel = shortenLabel(rawLabel);
                            // Use colours from the size label (e.g. "Red"), or fall back to
                            // the group description colours (e.g. "Orange & Blue" vest sizes)
                            const rowColors = getSwatchColors(sizeLabel);
                            const dotColors = rowColors.length > 0 ? rowColors : groupColors;
                            return (
                              <div
                                key={p.id}
                                className={`flex items-center gap-3 py-2.5 pl-[5.5rem] pr-4 ${
                                  i > 0 ? "border-t border-slate-800/60" : ""
                                } ${q > 0 ? "bg-green-950/10" : ""}`}
                              >
                                {/* Colour swatch dot */}
                                <div className="flex shrink-0 items-center gap-2">
                                  <ColourDot colors={dotColors} />
                                  <span className="w-20 text-sm text-slate-300">{sizeLabel}</span>
                                </div>
                                {!allSamePrice && (
                                  <span className="text-xs text-slate-600">£{p.unitCost.toFixed(2)}</span>
                                )}
                                {q > 0 && (
                                  <span className="text-xs text-green-600">
                                    £{(q * p.unitCost).toFixed(2)}
                                  </span>
                                )}
                                <div className="ml-auto">{renderStepper(p, dept)}</div>
                              </div>
                            );
                          })}
                        </div>
                      )}
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

  const activeProducts = activeTab === "CS" ? csProducts : faProducts;

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
          <div className="mx-auto max-w-3xl px-4 py-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-xs font-semibold text-slate-400">
                {convention.name}
                <span className="ml-2 font-normal text-slate-600">
                  · {grandLines} line{grandLines !== 1 ? "s" : ""}
                  {csLines > 0 && faLines > 0 && <> (CS&nbsp;{csLines} · FA&nbsp;{faLines})</>}
                </span>
              </span>
            </div>
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

      <div className="mx-auto max-w-3xl px-4 py-8">

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
          <p className="mt-8 text-center text-xs text-slate-600">
            Quantities save automatically. You can return and adjust until your order is confirmed.
          </p>
        )}
      </div>
    </main>
  );
}
