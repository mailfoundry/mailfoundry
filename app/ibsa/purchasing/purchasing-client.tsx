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
  firstaid:   "First Aid",
  chemicals:  "Chemicals",
  janitorial: "Janitorial",
  special:    "Special",
};

export type Convention = {
  id: string;
  name: string;
  conventionDate: string;
  status: string;
  collectionDate: string | null;
  faStatus: string;
  faCollectionDate: string | null;
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

type ProductContribution = {
  ibsaProductId: string;
  name: string;
  units: number;
};

type RsOrderLine = RsProductLine & {
  displayLabel: string;
  unitsNeeded: number;
  cartonsNeeded: number | null;
  totalCost: number | null;
  productBreakdown: ProductContribution[];
};

// A selectable card = one (convention, dept) pair
type Card = {
  key: string;           // `${conventionId}:${dept}`
  conventionId: string;
  name: string;
  dept: "CS" | "FA";
  collectionDate: string | null;
  conventionDate: string;
};

type Props = {
  conventions: Convention[];
  orderItems: OrderItemFlat[];
  rsProducts: RsProductLine[];
};

type OrderState = "idle" | "confirming" | "submitting" | "done";

function makePONumber(supplier: string) {
  const now = new Date();
  const supplierCode = supplier.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 4);
  const dateCode = now.toISOString().slice(0, 10).replace(/-/g, "");
  return `PO-${dateCode}-${supplierCode}`;
}

export default function PurchasingClient({ conventions, orderItems, rsProducts }: Props) {
  const [showRsOrder, setShowRsOrder] = useState(false);
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

    for (const item of orderItems) {
      const key = `${item.conventionId}:${item.dept}`;
      if (!selected.has(key)) continue;
      const p = item.product;
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
      const row = byProduct.get(p.id)!;
      if (item.dept === "CS") row.csOrdered += item.qty;
      else row.faOrdered += item.qty;
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
  }, [orderItems, selected]);

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

  const rsOrderBySupplier = useMemo(() => {
    const lineMap = new Map<string, RsOrderLine>();
    const unlinkedProducts: string[] = [];

    for (const row of rows) {
      const linked = rsProductsByIbsaId.get(row.productId) ?? [];
      if (linked.length === 0) {
        unlinkedProducts.push(row.name + (row.variant ? ` (${row.variant})` : ""));
        continue;
      }
      const productLabel = row.name + (row.variant ? ` (${row.variant})` : "");
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
          });
        }
        lineMap.get(key)!.unitsNeeded += row.deficit;
        lineMap.get(key)!.productBreakdown.push({
          ibsaProductId: row.productId,
          name: productLabel,
          units: row.deficit,
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
    // Sort supplier groups: those with any catalog data first, then alpha
    const sortedSuppliers = new Map(
      [...bySupplier.entries()].sort(([aName, aLines], [bName, bLines]) => {
        const aHas = aLines.some(l => l.rsCode);
        const bHas = bLines.some(l => l.rsCode);
        if (aHas !== bHas) return aHas ? -1 : 1;
        return aName.localeCompare(bName);
      })
    );

    return { bySupplier: sortedSuppliers, unlinkedProducts };
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
        <h1 className="text-2xl font-bold text-white">Purchasing</h1>
        <p className="mt-1 text-sm text-slate-400">
          Select the convention shipments you&apos;re buying for to see what you&apos;re short on.
        </p>
      </div>

      {/* Convention selector */}
      <div className="mb-8 rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-white">Shipments</p>
          <div className="flex gap-3 text-xs">
            <button onClick={selectAll} className="text-slate-400 hover:text-white transition-colors">Select all</button>
            <span className="text-slate-700">·</span>
            <button onClick={clearAll} className="text-slate-400 hover:text-white transition-colors">Clear</button>
          </div>
        </div>
        {cards.length === 0 ? (
          <p className="text-sm text-slate-500">No upcoming shipments found.</p>
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
                      : "border-slate-800 hover:border-slate-600 hover:bg-slate-800/50"
                  }`}
                >
                  <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                    isSelected ? "border-blue-500 bg-blue-600" : "border-slate-600"
                  }`}>
                    {isSelected && (
                      <svg className="h-2.5 w-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 12 12">
                        <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <span>
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{c.name}</span>
                      <span className={`rounded px-1.5 py-0 text-xs font-bold ${
                        c.dept === "CS"
                          ? "bg-blue-900/50 text-blue-300"
                          : "bg-green-900/50 text-green-300"
                      }`}>{c.dept}</span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                      <span className="text-slate-600">{c.collectionDate ? "Collection:" : "Convention:"}</span>
                      {fmtDate(displayDate)}
                      {soon && (
                        <span className="rounded-full bg-amber-900/50 border border-amber-700/40 px-1.5 py-0 text-amber-400">
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
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-12 text-center">
          <p className="text-slate-400">Select one or more shipments above to see what you need to buy.</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-12 text-center">
          <p className="text-slate-400">You&apos;re fully stocked for the selected shipments. Nothing to buy.</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="mb-6 grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Products to buy</p>
              <p className="mt-2 text-3xl font-bold text-white">{rows.length}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total units short</p>
              <p className="mt-2 text-3xl font-bold text-white">{totalUnits.toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Est. cost (ex VAT)</p>
              <p className="mt-2 text-3xl font-bold text-amber-400">{fmtGbp(totalCost)}</p>
            </div>
          </div>

          {/* Deficit / RS Order toggle */}
          <div className="mb-6 flex items-center gap-2">
            <button
              onClick={() => setShowRsOrder(false)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                !showRsOrder ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Deficit
            </button>
            <button
              onClick={() => setShowRsOrder(true)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                showRsOrder ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Supplier Order
            </button>
          </div>

          {/* ── DEFICIT VIEW ─────────────────────────────────────────────── */}
          {!showRsOrder && (
            <div className="overflow-hidden rounded-xl border border-slate-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/80 text-xs text-slate-500">
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
                <tbody className="bg-slate-900">
                  {Array.from(byCategory.entries()).map(([cat, catRows]) => (
                    <>
                      <tr key={`cat-${cat}`} className="border-t border-slate-800 bg-slate-800/60">
                        <td colSpan={8} className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                          {categoryLabel[cat] ?? cat}
                        </td>
                      </tr>
                      {catRows.map(r => (
                        <tr key={r.productId} className="border-t border-slate-800 hover:bg-slate-800/50">
                          <td className="px-4 py-3">
                            <p className="font-medium text-white">{r.name}</p>
                            {r.variant && <p className="text-xs text-slate-500">{r.variant}</p>}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-slate-300">
                            {r.csOrdered > 0 ? r.csOrdered : <span className="text-slate-600">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-slate-300">
                            {r.faOrdered > 0 ? r.faOrdered : <span className="text-slate-600">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-slate-300">{r.inStock}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-slate-300">
                            {r.git > 0 ? r.git : <span className="text-slate-600">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="inline-block rounded-full border border-red-800/40 bg-red-950/50 px-2.5 py-0.5 text-xs font-bold tabular-nums text-red-400">
                              {r.deficit}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-slate-400">{fmtGbp(r.xyloCost ?? r.unitCost)}</td>
                          <td className="px-4 py-3 text-right tabular-nums font-semibold text-white">
                            {fmtGbp(r.deficit * (r.xyloCost ?? r.unitCost))}
                          </td>
                        </tr>
                      ))}
                      <tr key={`sub-${cat}`} className="border-t border-slate-700 bg-slate-900/80">
                        <td colSpan={7} className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Subtotal
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums font-bold text-amber-400">
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
          {showRsOrder && (
            <div className="space-y-6">
              {/* Summary bar */}
              <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-5 py-4">
                <p className="text-sm text-slate-400">
                  <span className="font-semibold text-white">
                    {Array.from(rsOrderBySupplier.bySupplier.values()).reduce((s, l) => s + l.length, 0)}
                  </span>{" "}
                  supplier lines across{" "}
                  <span className="font-semibold text-white">{rsOrderBySupplier.bySupplier.size}</span>{" "}
                  {rsOrderBySupplier.bySupplier.size === 1 ? "supplier" : "suppliers"}
                </p>
                <p className="text-sm font-semibold text-amber-400">{fmtGbp(rsOrderTotalCost)} total (ex VAT)</p>
              </div>

              {/* Warning: deficit products with no supplier link */}
              {rsOrderBySupplier.unlinkedProducts.length > 0 && (
                <div className="rounded-xl border border-amber-700/40 bg-amber-950/20 px-5 py-4">
                  <p className="text-sm font-semibold text-amber-300">
                    {rsOrderBySupplier.unlinkedProducts.length} product{rsOrderBySupplier.unlinkedProducts.length !== 1 ? "s" : ""} not linked to a supplier — not included in order:
                  </p>
                  <p className="mt-1 text-xs text-amber-500">
                    {rsOrderBySupplier.unlinkedProducts.join(", ")}
                  </p>
                </div>
              )}

              {/* One table per supplier */}
              {Array.from(rsOrderBySupplier.bySupplier.entries()).map(([supplier, lines]) => {
                const supplierTotal = lines.reduce((s, l) => s + (l.totalCost ?? 0), 0);
                const pendingCount = lines.filter(l => l.cartonSize == null).length;
                return (
                  <div key={supplier} className="overflow-hidden rounded-xl border border-slate-800">
                    <div className="flex items-center justify-between border-b border-slate-800 bg-slate-800/80 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <p className="font-semibold text-white">{supplier}</p>
                        {pendingCount > 0 && (
                          <span className="rounded border border-amber-700/40 bg-amber-950/30 px-2 py-0.5 text-xs text-amber-400">
                            {pendingCount} without catalog data
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {supplierTotal > 0
                          ? <p className="text-sm font-semibold text-amber-400">{fmtGbp(supplierTotal)}</p>
                          : <p className="text-xs text-slate-500">cost unknown</p>
                        }
                        <button
                          onClick={() => handleDownloadPO(supplier, lines)}
                          className="rounded border border-slate-600 bg-slate-700 px-3 py-1 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-600 hover:text-white"
                        >
                          ↓ Download PO
                        </button>
                        {(() => {
                          const state = orderStates.get(supplier) ?? "idle";
                          if (state === "done") {
                            return (
                              <span className="rounded border border-green-700/60 bg-green-950/40 px-3 py-1 text-xs font-semibold text-green-400">
                                ✓ Ordered
                              </span>
                            );
                          }
                          return (
                            <button
                              onClick={() => openConfirmOrder(supplier, lines)}
                              disabled={state === "submitting" || lines.filter(l => l.cartonsNeeded != null).length === 0}
                              className="rounded border border-blue-700/60 bg-blue-950/40 px-3 py-1 text-xs font-semibold text-blue-300 transition-colors hover:bg-blue-900/50 hover:text-blue-200 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {state === "submitting" ? "Saving…" : "✓ Mark as Ordered"}
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-900/60 text-xs text-slate-500">
                          <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider">Code</th>
                          <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider">Description</th>
                          <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider">Variant</th>
                          <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">Carton</th>
                          <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">Shortfall</th>
                          <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">Cartons</th>
                          <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">Price/carton</th>
                          <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">Total</th>
                        </tr>
                      </thead>
                      <tbody className="bg-slate-900">
                        {lines.map(line => {
                          const hasCatalog = line.cartonSize != null;
                          return (
                            <tr key={line.id} className={`border-t border-slate-800 ${hasCatalog ? "hover:bg-slate-800/50" : "opacity-70 hover:opacity-100"}`}>
                              <td className="px-4 py-3 font-mono text-xs text-slate-400">
                                {line.rsCode ?? <span className="text-slate-700">—</span>}
                              </td>
                              <td className="px-4 py-3 text-white">{line.displayLabel}</td>
                              <td className="px-4 py-3">
                                {line.rsVariant
                                  ? <span className="rounded bg-slate-700 px-1.5 py-0.5 text-xs font-medium text-slate-300">{line.rsVariant}</span>
                                  : <span className="text-slate-600">—</span>
                                }
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums text-slate-400">
                                {line.cartonSize ?? <span className="text-slate-600">—</span>}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums text-slate-300">{line.unitsNeeded}</td>
                              <td className="px-4 py-3 text-right">
                                {line.cartonsNeeded != null
                                  ? <span className="inline-block rounded-full border border-blue-800/40 bg-blue-950/50 px-2.5 py-0.5 text-xs font-bold tabular-nums text-blue-300">
                                      {line.cartonsNeeded}
                                    </span>
                                  : <span className="text-slate-600">—</span>
                                }
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums text-slate-400">
                                {line.cartonPrice != null ? fmtGbp(line.cartonPrice) : <span className="text-slate-600">—</span>}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums font-semibold text-white">
                                {line.totalCost != null ? fmtGbp(line.totalCost) : <span className="font-normal text-slate-600">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                        <tr className="border-t border-slate-700 bg-slate-900/80">
                          <td colSpan={7} className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                            {pendingCount > 0 ? `Subtotal (excl. ${pendingCount} pending)` : "Subtotal"}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums font-bold text-amber-400">
                            {supplierTotal > 0 ? fmtGbp(supplierTotal) : <span className="text-slate-600">—</span>}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
      {/* Mark-as-Ordered confirm dialog */}
      {confirmSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <h2 className="text-base font-bold text-white">Confirm order</h2>
            <p className="mt-2 text-sm text-slate-300">
              Save{" "}
              <span className="font-mono font-semibold text-blue-400">
                {confirmSupplier.poNumber}
              </span>{" "}
              for <span className="font-semibold text-white">{confirmSupplier.supplier}</span>?
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {confirmSupplier.lines.filter(l => l.cartonsNeeded != null).length} orderable{" "}
              line{confirmSupplier.lines.filter(l => l.cartonsNeeded != null).length !== 1 ? "s" : ""} will be recorded.
              This won&apos;t change stock levels — book in the delivery when it arrives.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setConfirmSupplier(null)}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={submitOrder}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
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
