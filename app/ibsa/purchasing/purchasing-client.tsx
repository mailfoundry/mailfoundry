"use client";

import { useState, useMemo, useTransition } from "react";
import { downloadPO } from "./generatePO";
import type { POLine } from "./generatePO";
import { markAsOrdered } from "./order-actions";

const fmtGbp = (n: number) =>
  n.toLocaleString("en-GB", { style: "currency", currency: "GBP" });

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

const daysFromNow = (iso: string) => {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.round(diff / 86_400_000);
};

const categoryLabel: Record<string, string> = {
  safety_ppe: "Safety & PPE",
  mops:       "Mops",
  janitorial: "Janitorial",
  chemicals:  "Cleaning Chemicals",
  gloves:     "Gloves",
  hivis:      "Hi Vis",
  brushes:    "Brushes",
  handles:    "Handles",
  firstaid:   "First Aid",
  special:    "Special Order",
};

export type Convention = {
  id: string;
  name: string;
  conventionDate: string;
  status: string;
  collectionDate: string | null;
  faStatus: string;
  faCollectionDate: string | null;
  requiredBy?: string | null;
  submittedAt?: string | null;
};

export type OrderItemFlat = {
  conventionId: string;
  dept: string;
  qty: number;
  product: {
    id: string;
    name: string;
    variant: string | null;
    category: string;
    unitCost: number;
    xyloCost: number | null;
    inStock: number;
    git: number;
  };
};

export type RsProductLine = {
  id: string;
  supplier: string;
  rsCode: string | null;        // null = supplier link only, catalog data not yet entered
  rsVariant: string | null;
  rsDescription: string | null; // null = use product name from deficit row
  cartonSize: number | null;    // null = catalog data pending
  cartonPrice: number | null;   // null = catalog data pending
  ibsaProductId: string | null;
};

export type BomComponentLine = {
  componentId: string;
  qty: number;
  componentProduct: {
    id: string;
    name: string;
    variant: string | null;
    category: string;
    unitCost: number;
    xyloCost: number | null;
    inStock: number;
    git: number;
  };
};

type ProductContribution = {
  ibsaProductId: string;
  name: string;
  units: number;
  inStock: number;
};

type RsOrderLine = RsProductLine & {
  displayLabel: string;
  unitsNeeded: number;
  cartonsNeeded: number | null;
  totalCost: number | null;
  productBreakdown: ProductContribution[];
  lineInStock: number;
};

// A selectable card = one (convention, dept) pair
type Card = {
  key: string;           // `${conventionId}:${dept}`
  conventionId: string;
  name: string;
  dept: "CS" | "FA";
  collectionDate: string | null;
  conventionDate: string;
  requiredBy?: string | null;
  submittedAt?: string | null;
};

type Props = {
  conventions: Convention[];
  orderItems: OrderItemFlat[];
  rsProducts: RsProductLine[];
  /** BOM lines keyed by composite product ID. When present, demand is split into components. */
  bomByComposite: Record<string, BomComponentLine[]>;
};

type OrderState = "idle" | "confirming" | "submitting" | "done";

function makePONumber(supplier: string) {
  const now = new Date();
  const supplierCode = supplier.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 4);
  const dateCode = now.toISOString().slice(0, 10).replace(/-/g, "");
  return `PO-${dateCode}-${supplierCode}`;
}

type ViewMode = "deficit" | "rsOrder" | "buyingPower";

const FREE_SHIPPING_THRESHOLD = 85; // ex-VAT

export default function PurchasingClient({ conventions, orderItems, rsProducts, bomByComposite }: Props) {
  const [view, setView] = useState<ViewMode>("deficit");
  const [bpSupplier, setBpSupplier] = useState<string | null>(null);
  const [orderStates, setOrderStates] = useState<Map<string, OrderState>>(() => new Map());
  const [confirmSupplier, setConfirmSupplier] = useState<{ supplier: string; poNumber: string; lines: RsOrderLine[] } | null>(null);
  const [, startTransition] = useTransition();

  // ── Convention cards ─────────────────────────────────────────────────────
  const cards = useMemo<Card[]>(() => {
    const deptsByConvention = new Map<string, Set<string>>();
    for (const item of orderItems) {
      if (!deptsByConvention.has(item.conventionId))
        deptsByConvention.set(item.conventionId, new Set());
      deptsByConvention.get(item.conventionId)!.add(item.dept);
    }

    const result: Card[] = [];
    for (const c of conventions) {
      const depts = deptsByConvention.get(c.id) ?? new Set();
      if (depts.has("CS") && c.status !== "complete") {
        result.push({
          key: `${c.id}:CS`,
          conventionId: c.id,
          name: c.name,
          dept: "CS",
          collectionDate: c.collectionDate,
          conventionDate: c.conventionDate,
          requiredBy: c.requiredBy,
          submittedAt: c.submittedAt,
        });
      }
      if (depts.has("FA") && c.faStatus !== "complete") {
        result.push({
          key: `${c.id}:FA`,
          conventionId: c.id,
          name: c.name,
          dept: "FA",
          collectionDate: c.faCollectionDate,
          conventionDate: c.conventionDate,
          requiredBy: c.requiredBy,
          submittedAt: c.submittedAt,
        });
      }
    }

    return result.sort((a, b) => {
      const aDate = a.collectionDate ?? a.conventionDate;
      const bDate = b.collectionDate ?? b.conventionDate;
      return new Date(aDate).getTime() - new Date(bDate).getTime();
    });
  }, [conventions, orderItems]);

  const [selected, setSelected] = useState<Set<string>>(() =>
    cards.length > 0 ? new Set([cards[0].key]) : new Set()
  );

  const toggle = (key: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const selectAll = () => setSelected(new Set(cards.map(c => c.key)));
  const clearAll  = () => setSelected(new Set());

  // ── Deficit rows ─────────────────────────────────────────────────────────
  const rows = useMemo(() => {
    if (selected.size === 0) return [];

    type Acc = {
      productId: string;
      name: string;
      variant: string | null;
      category: string;
      unitCost: number;
      xyloCost: number | null;
      inStock: number;
      git: number;
      csOrdered: number;
      faOrdered: number;
    };

    const byProduct = new Map<string, Acc>();

    const ensureProduct = (p: { id: string; name: string; variant: string | null; category: string; unitCost: number; xyloCost: number | null; inStock: number; git: number }) => {
      if (!byProduct.has(p.id)) {
        byProduct.set(p.id, {
          productId: p.id,
          name: p.name,
          variant: p.variant,
          category: p.category,
          unitCost: p.unitCost,
          xyloCost: p.xyloCost,
          inStock: p.inStock,
          git: p.git,
          csOrdered: 0,
          faOrdered: 0,
        });
      }
      return byProduct.get(p.id)!;
    };

    for (const item of orderItems) {
      const cardKey = `${item.conventionId}:${item.dept}`;
      if (!selected.has(cardKey)) continue;

      const bomLines = bomByComposite[item.product.id];

      if (bomLines && bomLines.length > 0) {
        // Composite product — expand demand into components
        for (const bomLine of bomLines) {
          const cp = bomLine.componentProduct;
          const demand = item.qty * bomLine.qty;
          const row = ensureProduct(cp);
          if (item.dept === "CS") row.csOrdered += demand;
          else row.faOrdered += demand;
        }
      } else {
        // Standalone product — count normally
        const p = item.product;
        const row = ensureProduct(p);
        if (item.dept === "CS") row.csOrdered += item.qty;
        else row.faOrdered += item.qty;
      }
    }

    return Array.from(byProduct.values())
      .map(r => ({
        ...r,
        deficit: r.csOrdered + r.faOrdered - (r.inStock + r.git),
      }))
      .filter(r => r.deficit > 0)
      .sort((a, b) => {
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        return b.deficit - a.deficit;
      });
  }, [orderItems, selected, bomByComposite]);

  const byCategory = useMemo(() => {
    const map = new Map<string, typeof rows>();
    for (const r of rows) {
      if (!map.has(r.category)) map.set(r.category, []);
      map.get(r.category)!.push(r);
    }
    return map;
  }, [rows]);

  const totalCost  = rows.reduce((s, r) => s + r.deficit * (r.xyloCost ?? r.unitCost), 0);
  const totalUnits = rows.reduce((s, r) => s + r.deficit, 0);

  // ── Supplier list (for buying power picker) ──────────────────────────────
  const supplierNames = useMemo(
    () => [...new Set(rsProducts.map(r => r.supplier))].sort(),
    [rsProducts]
  );

  // ── RS Order calculation ─────────────────────────────────────────────────
  const rsProductsByIbsaId = useMemo(() => {
    const map = new Map<string, RsProductLine[]>();
    for (const rp of rsProducts) {
      if (!rp.ibsaProductId) continue;
      if (!map.has(rp.ibsaProductId)) map.set(rp.ibsaProductId, []);
      map.get(rp.ibsaProductId)!.push(rp);
    }
    return map;
  }, [rsProducts]);

  const UNKNOWN_SUPPLIER = "Unknown Supplier";

  const rsOrderBySupplier = useMemo(() => {
    const lineMap = new Map<string, RsOrderLine>();
    // Unlinked products go into a synthetic "Unknown Supplier" group so they're never missed
    const unknownLines: RsOrderLine[] = [];

    for (const row of rows) {
      const linked = rsProductsByIbsaId.get(row.productId) ?? [];
      const productLabel = row.name + (row.variant ? ` (${row.variant})` : "");

      if (linked.length === 0) {
        unknownLines.push({
          id: `unlinked_${row.productId}`,
          supplier: UNKNOWN_SUPPLIER,
          rsCode: null,
          rsVariant: row.variant,
          rsDescription: null,
          cartonSize: null,
          cartonPrice: null,
          ibsaProductId: row.productId,
          displayLabel: productLabel,
          unitsNeeded: row.deficit,
          cartonsNeeded: null,
          totalCost: null,
          productBreakdown: [{ ibsaProductId: row.productId, name: productLabel, units: row.deficit, inStock: row.inStock }],
          lineInStock: row.inStock,
        });
        continue;
      }

      for (const rp of linked) {
        // Lines with a catalog code aggregate by (supplier, rsCode, rsVariant);
        // supplier-only links are unique per ibsaProduct (no merging across products)
        const key = rp.rsCode
          ? `${rp.supplier}::${rp.rsCode}::${rp.rsVariant ?? ""}`
          : `${rp.supplier}::_link_::${rp.id}`;
        if (!lineMap.has(key)) {
          lineMap.set(key, {
            ...rp,
            displayLabel: rp.rsDescription ?? productLabel,
            unitsNeeded: 0,
            cartonsNeeded: null,
            totalCost: null,
            productBreakdown: [],
            lineInStock: 0,
          });
        }
        lineMap.get(key)!.unitsNeeded += row.deficit;
        lineMap.get(key)!.lineInStock += row.inStock;
        lineMap.get(key)!.productBreakdown.push({
          ibsaProductId: row.productId,
          name: productLabel,
          units: row.deficit,
          inStock: row.inStock,
        });
      }
    }

    // Calculate cartons & cost only for lines that have catalog data
    for (const line of lineMap.values()) {
      if (line.cartonSize != null && line.cartonPrice != null) {
        line.cartonsNeeded = Math.ceil(line.unitsNeeded / line.cartonSize);
        line.totalCost = line.cartonsNeeded * line.cartonPrice;
      }
    }

    // Group by supplier; within each supplier: catalog lines first (by rsCode), then supplier-only (by label)
    const bySupplier = new Map<string, RsOrderLine[]>();
    for (const line of lineMap.values()) {
      if (!bySupplier.has(line.supplier)) bySupplier.set(line.supplier, []);
      bySupplier.get(line.supplier)!.push(line);
    }
    for (const lines of bySupplier.values()) {
      lines.sort((a, b) => {
        if (!!a.rsCode !== !!b.rsCode) return a.rsCode ? -1 : 1; // catalog first
        return (a.rsCode ?? a.displayLabel).localeCompare(b.rsCode ?? b.displayLabel);
      });
    }
    // Sort supplier groups: those with any catalog data first, then alpha; Unknown Supplier always last
    const sortedSuppliers = new Map(
      [...bySupplier.entries()].sort(([aName, aLines], [bName, bLines]) => {
        if (aName === UNKNOWN_SUPPLIER) return 1;
        if (bName === UNKNOWN_SUPPLIER) return -1;
        const aHas = aLines.some(l => l.rsCode);
        const bHas = bLines.some(l => l.rsCode);
        if (aHas !== bHas) return aHas ? -1 : 1;
        return aName.localeCompare(bName);
      })
    );

    // Append Unknown Supplier group if there are any unlinked lines
    if (unknownLines.length > 0) {
      sortedSuppliers.set(UNKNOWN_SUPPLIER, unknownLines);
    }

    return { bySupplier: sortedSuppliers };
  }, [rows, rsProductsByIbsaId]);

  const rsOrderTotalCost = useMemo(() => {
    let total = 0;
    for (const lines of rsOrderBySupplier.bySupplier.values()) {
      total += lines.reduce((s, l) => s + (l.totalCost ?? 0), 0);
    }
    return total;
  }, [rsOrderBySupplier]);

  function handleDownloadPO(supplier: string, lines: RsOrderLine[]) {
    const conventionNames = cards
      .filter((c) => selected.has(c.key))
      .map((c) => `${c.name} ${c.dept} — ${fmtDate(c.conventionDate)}`);
    const poLines: POLine[] = lines.map((l) => ({
      rsCode: l.rsCode,
      displayLabel: l.displayLabel,
      rsVariant: l.rsVariant,
      cartonSize: l.cartonSize,
      unitsNeeded: l.unitsNeeded,
      cartonsNeeded: l.cartonsNeeded,
      cartonPrice: l.cartonPrice,
      totalCost: l.totalCost,
    }));
    downloadPO({ supplier, lines: poLines, conventionNames });
  }

  function openConfirmOrder(supplier: string, lines: RsOrderLine[]) {
    const poNumber = makePONumber(supplier);
    setConfirmSupplier({ supplier, poNumber, lines });
  }

  function submitOrder() {
    if (!confirmSupplier) return;
    const { supplier, poNumber, lines } = confirmSupplier;
    // Only include lines that have catalog data (cartons can be calculated)
    const orderableLines = lines.filter((l) => l.cartonsNeeded != null);
    const totalExVat = orderableLines.reduce((s, l) => s + (l.totalCost ?? 0), 0);

    setOrderStates((prev) => new Map(prev).set(supplier, "submitting"));
    setConfirmSupplier(null);

    const fd = new FormData();
    fd.set("supplier", supplier);
    fd.set("poNumber", poNumber);
    fd.set("totalExVat", String(totalExVat));
    fd.set(
      "lines",
      JSON.stringify(
        orderableLines.map((l) => ({
          rsCode: l.rsCode,
          description: l.displayLabel,
          variant: l.rsVariant,
          cartonSize: l.cartonSize,
          cartonsOrdered: l.cartonsNeeded!,
          pricePerCarton: l.cartonPrice,
          totalCost: l.totalCost,
          productBreakdown: l.productBreakdown,
        }))
      )
    );

    startTransition(async () => {
      await markAsOrdered(fd);
      setOrderStates((prev) => new Map(prev).set(supplier, "done"));
      // Reset to idle after 3 s
      setTimeout(() => {
        setOrderStates((prev) => {
          const next = new Map(prev);
          next.set(supplier, "idle");
          return next;
        });
      }, 3000);
    });
  }

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Purchasing</h1>
        <p className="mt-1 text-sm text-gray-500">
          Select the convention shipments you&apos;re buying for to see what you&apos;re short on.
        </p>
      </div>

      {/* Convention selector */}
      <div className="mb-8 rounded-xl border border-gray-200 bg-white shadow-sm p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-900">Shipments</p>
          <div className="flex gap-3 text-xs">
            <button onClick={selectAll} className="text-gray-500 hover:text-gray-900 transition-colors">Select all</button>
            <span className="text-gray-200">·</span>
            <button onClick={clearAll} className="text-gray-500 hover:text-gray-900 transition-colors">Clear</button>
          </div>
        </div>
        {cards.length === 0 ? (
          <p className="text-sm text-gray-400">No upcoming shipments found.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {cards.map(c => {
              const displayDate = c.collectionDate ?? c.conventionDate;
              const days = daysFromNow(displayDate);
              const isSelected = selected.has(c.key);
              const soon = days >= 0 && days <= 7;
              return (
                <button
                  key={c.key}
                  onClick={() => toggle(c.key)}
                  className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-all ${
                    isSelected
                      ? "border-blue-700 bg-blue-950/40"
                      : "border-gray-200 hover:border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                    isSelected ? "border-blue-500 bg-blue-600" : "border-gray-200"
                  }`}>
                    {isSelected && (
                      <svg className="h-2.5 w-2.5 text-gray-900" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 12 12">
                        <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <span>
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{c.name}</span>
                      <span className={`rounded px-1.5 py-0 text-xs font-bold ${
                        c.dept === "CS"
                          ? "bg-blue-900/50 text-blue-700"
                          : "bg-green-900/50 text-green-300"
                      }`}>{c.dept}</span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-400">
                      <span className="text-gray-300">
                        {c.collectionDate ? "Collection:" : c.requiredBy ? "Required by:" : c.submittedAt ? "Submitted:" : "Convention:"}
                      </span>
                      {c.collectionDate
                        ? fmtDate(c.collectionDate)
                        : c.requiredBy
                        ? c.requiredBy
                        : c.submittedAt
                        ? fmtDate(c.submittedAt)
                        : fmtDate(c.conventionDate)}
                      {soon && (
                        <span className="rounded-full bg-amber-900/50 border border-amber-200 px-1.5 py-0 text-amber-600">
                          {days === 0 ? "today" : `${days}d`}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Results */}
      {selected.size === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-12 text-center">
          <p className="text-gray-500">Select one or more shipments above to see what you need to buy.</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-12 text-center">
          <p className="text-gray-500">You&apos;re fully stocked for the selected shipments. Nothing to buy.</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="mb-6 grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Products to buy</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{rows.length}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Total units short</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{totalUnits.toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Est. cost (ex VAT)</p>
              <p className="mt-2 text-3xl font-bold text-amber-600">{fmtGbp(totalCost)}</p>
            </div>
          </div>

          {/* View toggle */}
          <div className="mb-6 flex items-center gap-2">
            {(["deficit", "rsOrder", "buyingPower"] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => {
                  setView(v);
                  if (v === "buyingPower") selectAll();
                }}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  view === v ? "bg-gray-100 text-gray-900" : "text-gray-500 hover:text-gray-900"
                }`}
              >
                {v === "deficit" ? "Deficit" : v === "rsOrder" ? "Supplier Order" : "Buying Power"}
              </button>
            ))}
          </div>

          {/* ── DEFICIT VIEW ─────────────────────────────────────────────── */}
          {view === "deficit" && (
            <div className="overflow-hidden rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-white shadow-sm/80 text-xs text-gray-400">
                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider">Product</th>
                    <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">CS</th>
                    <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">FA</th>
                    <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">In Stock</th>
                    <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">GIT</th>
                    <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">Short by</th>
                    <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">Xylo cost</th>
                    <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">Est. cost</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {Array.from(byCategory.entries()).map(([cat, catRows]) => (
                    <>
                      <tr key={`cat-${cat}`} className="border-t border-gray-200 bg-gray-50">
                        <td colSpan={8} className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                          {categoryLabel[cat] ?? cat}
                        </td>
                      </tr>
                      {catRows.map(r => {
                        const totalAvailable = r.inStock + r.git;
                        const outOfStock = totalAvailable === 0;
                        const criticallyLow = !outOfStock && totalAvailable < (r.csOrdered + r.faOrdered) / 2;
                        return (
                        <tr key={r.productId} className={`border-t border-gray-200 ${outOfStock ? "bg-red-50/60" : criticallyLow ? "bg-amber-50/60" : "hover:bg-gray-50"}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div>
                                <p className="font-medium text-gray-900">{r.name}</p>
                                {r.variant && <p className="text-xs text-gray-400">{r.variant}</p>}
                              </div>
                              {outOfStock && (
                                <span className="shrink-0 rounded-full bg-red-100 border border-red-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-600">
                                  Out of stock
                                </span>
                              )}
                              {criticallyLow && (
                                <span className="shrink-0 rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                                  Low stock
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                            {r.csOrdered > 0 ? r.csOrdered : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                            {r.faOrdered > 0 ? r.faOrdered : <span className="text-gray-300">—</span>}
                          </td>
                          <td className={`px-4 py-3 text-right tabular-nums ${outOfStock ? "font-bold text-red-500" : "text-gray-600"}`}>{r.inStock}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                            {r.git > 0 ? r.git : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="inline-block rounded-full border border-red-200/40 bg-red-950/50 px-2.5 py-0.5 text-xs font-bold tabular-nums text-red-500">
                              {r.deficit}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-gray-500">{fmtGbp(r.xyloCost ?? r.unitCost)}</td>
                          <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-900">
                            {fmtGbp(r.deficit * (r.xyloCost ?? r.unitCost))}
                          </td>
                        </tr>
                        );
                      })}
                      <tr key={`sub-${cat}`} className="border-t border-gray-200 bg-white/80">
                        <td colSpan={7} className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">
                          Subtotal
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums font-bold text-amber-600">
                          {fmtGbp(catRows.reduce((s, r) => s + r.deficit * (r.xyloCost ?? r.unitCost), 0))}
                        </td>
                      </tr>
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── RS ORDER VIEW ────────────────────────────────────────────── */}
          {view === "rsOrder" && (
            <div className="space-y-6">
              {/* Summary bar */}
              <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white shadow-sm px-5 py-4">
                <p className="text-sm text-gray-500">
                  <span className="font-semibold text-gray-900">
                    {Array.from(rsOrderBySupplier.bySupplier.values()).reduce((s, l) => s + l.length, 0)}
                  </span>{" "}
                  supplier lines across{" "}
                  <span className="font-semibold text-gray-900">{rsOrderBySupplier.bySupplier.size}</span>{" "}
                  {rsOrderBySupplier.bySupplier.size === 1 ? "supplier" : "suppliers"}
                </p>
                <p className="text-sm font-semibold text-amber-600">{fmtGbp(rsOrderTotalCost)} total (ex VAT)</p>
              </div>


              {/* One table per supplier */}
              {Array.from(rsOrderBySupplier.bySupplier.entries()).map(([supplier, lines]) => {
                const isUnknownSupplier = supplier === UNKNOWN_SUPPLIER;
                const supplierTotal = lines.reduce((s, l) => s + (l.totalCost ?? 0), 0);
                const pendingCount = lines.filter(l => l.cartonSize == null).length;
                return (
                  <div key={supplier} className={`overflow-hidden rounded-xl border ${isUnknownSupplier ? "border-amber-200" : "border-gray-200"}`}>
                    <div className={`flex items-center justify-between border-b px-4 py-3 ${isUnknownSupplier ? "border-amber-200 bg-amber-50" : "border-gray-200 bg-gray-100/80"}`}>
                      <div className="flex items-center gap-3">
                        <p className={`font-semibold ${isUnknownSupplier ? "text-amber-700" : "text-gray-900"}`}>{supplier}</p>
                        {isUnknownSupplier
                          ? <span className="rounded border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs text-amber-700">Add supplier links on the Products page to order these</span>
                          : pendingCount > 0 && (
                            <span className="rounded border border-amber-200 bg-amber-950/30 px-2 py-0.5 text-xs text-amber-600">
                              {pendingCount} without catalog data
                            </span>
                          )
                        }
                      </div>
                      <div className="flex items-center gap-3">
                        {!isUnknownSupplier && (supplierTotal > 0
                          ? <p className="text-sm font-semibold text-amber-600">{fmtGbp(supplierTotal)}</p>
                          : <p className="text-xs text-gray-400">cost unknown</p>
                        )}
                        {!isUnknownSupplier && <button
                          onClick={() => handleDownloadPO(supplier, lines)}
                          className="rounded border border-gray-200 bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-200 hover:text-gray-900"
                        >
                          ↓ Download PO
                        </button>}
                        {!isUnknownSupplier && (() => {
                          const state = orderStates.get(supplier) ?? "idle";
                          if (state === "done") {
                            return (
                              <span className="rounded border border-green-700/60 bg-green-950/40 px-3 py-1 text-xs font-semibold text-green-600">
                                ✓ Ordered
                              </span>
                            );
                          }
                          return (
                            <button
                              onClick={() => openConfirmOrder(supplier, lines)}
                              disabled={state === "submitting" || lines.filter(l => l.cartonsNeeded != null).length === 0}
                              className="rounded border border-blue-700/60 bg-blue-950/40 px-3 py-1 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-900/50 hover:text-blue-200 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {state === "submitting" ? "Saving…" : "✓ Mark as Ordered"}
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                    <table className="w-full table-fixed text-sm">
                      <colgroup>
                        <col style={{ width: "7rem" }} />   {/* Code */}
                        <col />                              {/* Description — flex */}
                        <col style={{ width: "6rem" }} />   {/* Variant */}
                        <col style={{ width: "5rem" }} />   {/* Carton */}
                        <col style={{ width: "5.5rem" }} /> {/* In Stock */}
                        <col style={{ width: "5.5rem" }} /> {/* Shortfall */}
                        <col style={{ width: "5.5rem" }} /> {/* Cartons */}
                        <col style={{ width: "7rem" }} />   {/* Price/carton */}
                        <col style={{ width: "6rem" }} />   {/* Total */}
                      </colgroup>
                      <thead>
                        <tr className="border-b border-gray-200 bg-white shadow-sm/60 text-xs text-gray-400">
                          <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider">Code</th>
                          <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider">Description</th>
                          <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider">Variant</th>
                          <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">Carton</th>
                          <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">In Stock</th>
                          <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">Shortfall</th>
                          <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">Cartons</th>
                          <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">Price/carton</th>
                          <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">Total</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white">
                        {lines.map(line => {
                          const hasCatalog = line.cartonSize != null;
                          const isUnknown = supplier === UNKNOWN_SUPPLIER;
                          return (
                            <tr key={line.id} className={`border-t border-gray-200 ${isUnknown ? "bg-amber-50/40 opacity-80 hover:opacity-100" : hasCatalog ? "hover:bg-gray-50" : "opacity-70 hover:opacity-100"}`}>
                              <td className="px-4 py-3 font-mono text-xs text-gray-500 truncate">
                                {line.rsCode ?? <span className="text-gray-200">—</span>}
                              </td>
                              <td className="px-4 py-3 text-gray-900 truncate" title={line.displayLabel}>
                                {isUnknown
                                  ? <span className="flex items-center gap-1.5">{line.displayLabel} <span className="shrink-0 rounded border border-amber-200 bg-amber-100 px-1 py-0 text-[10px] font-semibold text-amber-700 uppercase tracking-wide">No supplier</span></span>
                                  : line.displayLabel
                                }
                              </td>
                              <td className="px-4 py-3 truncate">
                                {line.rsVariant
                                  ? <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">{line.rsVariant}</span>
                                  : <span className="text-gray-300">—</span>
                                }
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums text-gray-500">
                                {line.cartonSize ?? <span className="text-gray-300">—</span>}
                              </td>
                              <td className={`px-4 py-3 text-right tabular-nums font-medium ${line.lineInStock === 0 ? "text-red-400" : "text-gray-600"}`}>
                                {line.lineInStock}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums text-gray-600">{line.unitsNeeded}</td>
                              <td className="px-4 py-3 text-right">
                                {line.cartonsNeeded != null
                                  ? <span className="inline-block rounded-full border border-blue-800/40 bg-blue-950/50 px-2.5 py-0.5 text-xs font-bold tabular-nums text-blue-700">
                                      {line.cartonsNeeded}
                                    </span>
                                  : <span className="text-gray-300">—</span>
                                }
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums text-gray-500">
                                {line.cartonPrice != null ? fmtGbp(line.cartonPrice) : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-900">
                                {line.totalCost != null ? fmtGbp(line.totalCost) : <span className="font-normal text-gray-300">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                        <tr className="border-t border-gray-200 bg-white/80">
                          <td colSpan={8} className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">
                            {pendingCount > 0 ? `Subtotal (excl. ${pendingCount} pending)` : "Subtotal"}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums font-bold text-amber-600">
                            {supplierTotal > 0 ? fmtGbp(supplierTotal) : <span className="text-gray-300">—</span>}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── BUYING POWER VIEW ────────────────────────────────────────── */}
          {view === "buyingPower" && (() => {
            const bpLines = bpSupplier
              ? rsOrderBySupplier.bySupplier.get(bpSupplier) ?? []
              : null;
            const bpTotal = bpLines
              ? bpLines.reduce((s, l) => s + (l.totalCost ?? 0), 0)
              : 0;
            const toFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - bpTotal);
            const pct = Math.min(100, (bpTotal / FREE_SHIPPING_THRESHOLD) * 100);
            const pendingCount = bpLines ? bpLines.filter(l => l.cartonSize == null).length : 0;

            return (
              <div className="space-y-5">
                {/* Supplier picker */}
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm px-5 py-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Select supplier</p>
                  <div className="flex flex-wrap gap-2">
                    {supplierNames.filter(s => s !== UNKNOWN_SUPPLIER).map(s => (
                      <button
                        key={s}
                        onClick={() => setBpSupplier(s === bpSupplier ? null : s)}
                        className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                          bpSupplier === s
                            ? "border-blue-600 bg-blue-50 text-blue-700"
                            : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {!bpSupplier ? (
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-10 text-center">
                    <p className="text-sm text-gray-400">Pick a supplier above to see your combined buying power across all selected conventions.</p>
                  </div>
                ) : !bpLines || bpLines.length === 0 ? (
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-10 text-center">
                    <p className="text-sm text-gray-400">No items needed from <strong>{bpSupplier}</strong> across the selected conventions.</p>
                  </div>
                ) : (
                  <>
                    {/* Free shipping meter */}
                    <div className="rounded-xl border border-gray-200 bg-white shadow-sm px-5 py-4">
                      <div className="flex items-end justify-between mb-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Order total ({bpSupplier})</p>
                          <p className="mt-1 text-2xl font-bold text-gray-900">{fmtGbp(bpTotal)} <span className="text-sm font-normal text-gray-400">ex VAT</span></p>
                        </div>
                        {toFreeShipping > 0 ? (
                          <p className="text-sm text-amber-600 font-semibold">{fmtGbp(toFreeShipping)} to free shipping</p>
                        ) : (
                          <p className="text-sm text-green-600 font-semibold">✓ Qualifies for free shipping</p>
                        )}
                      </div>
                      <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={`h-2 rounded-full transition-all ${pct >= 100 ? "bg-green-500" : "bg-blue-500"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[10px] text-gray-400">Free shipping threshold: {fmtGbp(FREE_SHIPPING_THRESHOLD)} ex VAT</p>
                    </div>

                    {/* Order lines */}
                    <div className="overflow-hidden rounded-xl border border-gray-200">
                      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-100/80 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <p className="font-semibold text-gray-900">{bpSupplier}</p>
                          {pendingCount > 0 && (
                            <span className="rounded border border-amber-200 bg-amber-950/30 px-2 py-0.5 text-xs text-amber-600">
                              {pendingCount} without catalog data
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          {bpTotal > 0
                            ? <p className="text-sm font-semibold text-amber-600">{fmtGbp(bpTotal)}</p>
                            : <p className="text-xs text-gray-400">cost unknown</p>
                          }
                          <button
                            onClick={() => handleDownloadPO(bpSupplier, bpLines)}
                            className="rounded border border-gray-200 bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-200"
                          >
                            ↓ Download PO
                          </button>
                          {(() => {
                            const state = orderStates.get(bpSupplier) ?? "idle";
                            if (state === "done") return (
                              <span className="rounded border border-green-700/60 bg-green-950/40 px-3 py-1 text-xs font-semibold text-green-600">✓ Ordered</span>
                            );
                            return (
                              <button
                                onClick={() => openConfirmOrder(bpSupplier, bpLines)}
                                disabled={state === "submitting" || bpLines.filter(l => l.cartonsNeeded != null).length === 0}
                                className="rounded border border-blue-700/60 bg-blue-950/40 px-3 py-1 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-900/50 hover:text-blue-200 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                {state === "submitting" ? "Saving…" : "✓ Mark as Ordered"}
                              </button>
                            );
                          })()}
                        </div>
                      </div>
                      <table className="w-full table-fixed text-sm">
                        <colgroup>
                          <col style={{ width: "7rem" }} />
                          <col />
                          <col style={{ width: "6rem" }} />
                          <col style={{ width: "5rem" }} />
                          <col style={{ width: "5.5rem" }} />
                          <col style={{ width: "5.5rem" }} />
                          <col style={{ width: "5.5rem" }} />
                          <col style={{ width: "7rem" }} />
                          <col style={{ width: "6rem" }} />
                        </colgroup>
                        <thead>
                          <tr className="border-b border-gray-200 bg-white text-xs text-gray-400">
                            <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider">Code</th>
                            <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider">Description</th>
                            <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider">Variant</th>
                            <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">Carton</th>
                            <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">In Stock</th>
                            <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">Shortfall</th>
                            <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">Cartons</th>
                            <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">Price/carton</th>
                            <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">Total</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white">
                          {bpLines.map(line => (
                            <tr key={line.id} className={`border-t border-gray-200 ${line.cartonSize != null ? "hover:bg-gray-50" : "opacity-70"}`}>
                              <td className="px-4 py-3 font-mono text-xs text-gray-500 truncate">{line.rsCode ?? <span className="text-gray-200">—</span>}</td>
                              <td className="px-4 py-3 text-gray-900 truncate" title={line.displayLabel}>{line.displayLabel}</td>
                              <td className="px-4 py-3 truncate">
                                {line.rsVariant
                                  ? <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">{line.rsVariant}</span>
                                  : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums text-gray-500">{line.cartonSize ?? <span className="text-gray-300">—</span>}</td>
                              <td className={`px-4 py-3 text-right tabular-nums font-medium ${line.lineInStock === 0 ? "text-red-400" : "text-gray-600"}`}>{line.lineInStock}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-gray-600">{line.unitsNeeded}</td>
                              <td className="px-4 py-3 text-right">
                                {line.cartonsNeeded != null
                                  ? <span className="inline-block rounded-full border border-blue-800/40 bg-blue-950/50 px-2.5 py-0.5 text-xs font-bold tabular-nums text-blue-700">{line.cartonsNeeded}</span>
                                  : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums text-gray-500">{line.cartonPrice != null ? fmtGbp(line.cartonPrice) : <span className="text-gray-300">—</span>}</td>
                              <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-900">{line.totalCost != null ? fmtGbp(line.totalCost) : <span className="font-normal text-gray-300">—</span>}</td>
                            </tr>
                          ))}
                          <tr className="border-t border-gray-200 bg-white/80">
                            <td colSpan={8} className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">
                              {pendingCount > 0 ? `Subtotal (excl. ${pendingCount} pending)` : "Subtotal"}
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums font-bold text-amber-600">
                              {bpTotal > 0 ? fmtGbp(bpTotal) : <span className="text-gray-300">—</span>}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                      {/* Convention breakdown */}
                      <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Across conventions</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
                          {cards.filter(c => selected.has(c.key)).map(c => (
                            <span key={c.key}>{c.name} <span className={`font-semibold ${c.dept === "CS" ? "text-blue-600" : "text-green-600"}`}>{c.dept}</span></span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })()}
        </>
      )}
      {/* Mark-as-Ordered confirm dialog */}
      {confirmSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
            <h2 className="text-base font-bold text-gray-900">Confirm order</h2>
            <p className="mt-2 text-sm text-gray-600">
              Save{" "}
              <span className="font-mono font-semibold text-blue-600">
                {confirmSupplier.poNumber}
              </span>{" "}
              for <span className="font-semibold text-gray-900">{confirmSupplier.supplier}</span>?
            </p>
            <p className="mt-1 text-xs text-gray-400">
              {confirmSupplier.lines.filter(l => l.cartonsNeeded != null).length} orderable line{confirmSupplier.lines.filter(l => l.cartonsNeeded != null).length !== 1 ? "s" : ""}{" "}will be recorded.
              GIT will be updated immediately — book in the delivery when it arrives.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setConfirmSupplier(null)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={submitOrder}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-blue-500"
              >
                Save order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
