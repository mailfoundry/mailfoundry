"use client";

import { useState, useTransition, useEffect } from "react";
import { updateProductStock, bulkUpdateInStock, updateProduct, createProduct, createRsProductLink, deleteRsProductLink, addBomLine, removeBomLine, uploadProductImage, deleteProduct, toggleProductVisibility } from "./actions";
import { getImageSrc } from "../../../src/lib/image-utils";

export type RsProductLink = {
  id: string;
  supplier: string;
  rsCode: string | null;
  rsVariant: string | null;
  rsDescription: string | null;
};

export type BomLine = {
  id: string;
  componentId: string;
  qty: number;
  component: {
    id: string;
    code: string;
    name: string;
    variant: string | null;
  };
};

export type ProductRow = {
  id: string;
  name: string;
  variant: string | null;
  code: string;
  category: string;
  type: string;
  unitCost: number;
  xyloCost: number | null;
  description: string | null;
  imageUrl: string | null;
  groupImageUrl: string | null;
  groupWithVariants: boolean;
  groupDescription: string | null;
  visibleInOrderForm: boolean;
  inStock: number;
  git: number;
  rsProducts: RsProductLink[];
  bomAsComposite: BomLine[];
};

const CATEGORY_LABELS: Record<string, string> = {
  safety_ppe: "Safety & PPE",
  janitorial: "Janitorial",
  chemicals:  "Cleaning Chemicals",
  special:    "Special Order",
  firstaid:   "First Aid",
};

const CATEGORIES = [
  { value: "safety_ppe", label: "Safety & PPE" },
  { value: "janitorial", label: "Janitorial" },
  { value: "chemicals",  label: "Cleaning Chemicals" },
  { value: "special",    label: "Special Order" },
  { value: "firstaid",   label: "First Aid" },
];

type EditDraft = {
  name: string;
  variant: string;
  code: string;
  category: string;
  type: string;
  unitCost: string;
  xyloCost: string;
  description: string;
  imageUrl: string;
  groupImageUrl: string;
  groupDescription: string;
  groupWithVariants: boolean;
};

type Props = { products: ProductRow[]; activeType: "CS" | "FA" };

export default function ProductsClient({ products, activeType }: Props) {
  const [search, setSearch] = useState("");
  const [stockTakeMode, setStockTakeMode] = useState(false);
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [isSaving, startSaving] = useTransition();

  // Persist last-used tab so sidebar link and refresh restore position
  useEffect(() => {
    localStorage.setItem("ibsa-products-tab", activeType);
  }, [activeType]);

  // Edit modal state
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft>({
    name: "", variant: "", code: "", category: "", type: "", unitCost: "", xyloCost: "", description: "", groupDescription: "", imageUrl: "", groupImageUrl: "", groupWithVariants: false,
  });
  const [supplierDrafts, setSupplierDrafts] = useState<Map<string, string>>(new Map());
  const [isSavingEdit, startSavingEdit] = useTransition();
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeletingProduct, startDeletingProduct] = useTransition();
  const [isCreating, setIsCreating] = useState(false);

  // Add supplier link form state
  const [showAddLink, setShowAddLink] = useState(false);
  const [linkDraft, setLinkDraft] = useState({
    supplier: "", rsCode: "", rsVariant: "", rsDescription: "", cartonSize: "", cartonPrice: "",
  });
  const [isSavingLink, startSavingLink] = useTransition();

  // BOM form state
  const [showAddBom, setShowAddBom] = useState(false);
  const [bomDraft, setBomDraft] = useState<{ componentId: string; qty: string }>({ componentId: "", qty: "1" });
  const [isSavingBom, startSavingBom] = useTransition();

  // ── Derived ────────────────────────────────────────────────────────────
  const q = search.trim().toLowerCase();
  const filteredProducts = q
    ? products.filter(
        (p) =>
          p.code.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          (p.variant ?? "").toLowerCase().includes(q)
      )
    : products;

  const grouped = filteredProducts.reduce<Record<string, ProductRow[]>>((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {});

  const getInStock = (p: ProductRow) =>
    stockTakeMode ? (draft[p.id] ?? p.inStock) : p.inStock;

  const totalInStock = filteredProducts.reduce((s, p) => s + getInStock(p), 0);
  const totalGIT     = filteredProducts.reduce((s, p) => s + p.git, 0);
  const totalStock   = totalInStock + totalGIT;
  const inStockValue = filteredProducts.reduce((s, p) => s + p.unitCost * getInStock(p), 0);
  const gitValue     = filteredProducts.reduce((s, p) => s + p.unitCost * p.git, 0);
  const stockValue   = inStockValue + gitValue;

  const changedCount = stockTakeMode
    ? products.filter((p) => (draft[p.id] ?? p.inStock) !== p.inStock).length
    : 0;

  // Stock take summary stats
  const countedProducts = stockTakeMode
    ? products.filter((p) => (draft[p.id] ?? 0) > 0).length
    : 0;
  const totalCounted = stockTakeMode
    ? products.reduce((s, p) => s + (draft[p.id] ?? 0), 0)
    : 0;
  const countedValue = stockTakeMode
    ? products.reduce((s, p) => s + (draft[p.id] ?? 0) * p.unitCost, 0)
    : 0;
  const categoryTotals = stockTakeMode
    ? Object.entries(grouped).map(([cat, items]) => ({
        label: CATEGORY_LABELS[cat] ?? cat,
        total: items.reduce((s, p) => s + (draft[p.id] ?? 0), 0),
      })).filter((c) => c.total > 0)
    : [];

  // ── Stock take ─────────────────────────────────────────────────────────
  const enterStockTake = () => {
    const init: Record<string, number> = {};
    for (const p of products) init[p.id] = p.inStock;
    setDraft(init);
    setStockTakeMode(true);
  };

  const cancelStockTake = () => { setDraft({}); setStockTakeMode(false); };

  const saveAll = (exit = false) => {
    const updates = products
      .filter((p) => (draft[p.id] ?? p.inStock) !== p.inStock)
      .map((p) => ({ id: p.id, inStock: draft[p.id] ?? p.inStock }));
    startSaving(async () => {
      await bulkUpdateInStock(updates);
      setDraft({});
      if (exit) setStockTakeMode(false);
    });
  };

  const saveRow = (productId: string, inStock: number, git: number) => {
    const fd = new FormData();
    fd.append("productId", productId);
    fd.append("inStock", String(inStock));
    fd.append("git", String(git));
    updateProductStock(fd);
  };

  const adjustDraft = (id: string, delta: number, current: number) =>
    setDraft((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? current) + delta) }));

  // ── Edit modal ─────────────────────────────────────────────────────────
  function openNew() {
    setConfirmDelete(false);
    setIsCreating(true);
    setEditingProduct(null);
    setEditDraft({ name: "", variant: "", code: "", category: CATEGORIES[0].value, type: activeType, unitCost: "", xyloCost: "", description: "", groupDescription: "", imageUrl: "", groupImageUrl: "", groupWithVariants: false });
    setShowAddLink(false);
    setShowAddBom(false);
  }

  function openEdit(p: ProductRow) {
    setConfirmDelete(false);
    setIsCreating(false);
    setEditingProduct(p);
    setEditDraft({
      name:     p.name,
      variant:  p.variant ?? "",
      code:     p.code,
      category: p.category,
      type:     p.type,
      unitCost: String(p.unitCost),
      xyloCost: p.xyloCost != null ? String(p.xyloCost) : "",
      description: p.description ?? "",
      groupDescription: p.groupDescription ?? "",
      imageUrl: p.imageUrl ?? "",
      groupImageUrl: p.groupImageUrl ?? "",
      groupWithVariants: p.groupWithVariants,
    });
    const m = new Map<string, string>();
    for (const rp of p.rsProducts) m.set(rp.id, rp.supplier);
    setSupplierDrafts(m);
    setShowAddLink(false);
    setLinkDraft({ supplier: "", rsCode: "", rsVariant: "", rsDescription: "", cartonSize: "", cartonPrice: "" });
    setShowAddBom(false);
    setBomDraft({ componentId: "", qty: "1" });
  }

  function submitAddLink() {
    if (!editingProduct || !linkDraft.supplier.trim()) return;
    const fd = new FormData();
    fd.set("ibsaProductId", editingProduct.id);
    Object.entries(linkDraft).forEach(([k, v]) => fd.set(k, v));
    startSavingLink(async () => {
      await createRsProductLink(fd);
      setShowAddLink(false);
      setLinkDraft({ supplier: "", rsCode: "", rsVariant: "", rsDescription: "", cartonSize: "", cartonPrice: "" });
      setEditingProduct(null); // close modal — page revalidates with new link
    });
  }

  function submitDeleteLink(rsProductId: string) {
    const fd = new FormData();
    fd.set("id", rsProductId);
    startSavingLink(async () => {
      await deleteRsProductLink(fd);
      setEditingProduct((prev) =>
        prev ? { ...prev, rsProducts: prev.rsProducts.filter((rp) => rp.id !== rsProductId) } : null
      );
    });
  }

  function submitAddBomLine() {
    if (!editingProduct || !bomDraft.componentId) return;
    const fd = new FormData();
    fd.set("compositeId", editingProduct.id);
    fd.set("componentId", bomDraft.componentId);
    fd.set("qty", bomDraft.qty || "1");
    startSavingBom(async () => {
      await addBomLine(fd);
      setShowAddBom(false);
      setBomDraft({ componentId: "", qty: "1" });
      setEditingProduct(null);
    });
  }

  function submitRemoveBomLine(bomLineId: string) {
    const fd = new FormData();
    fd.set("id", bomLineId);
    startSavingBom(async () => {
      await removeBomLine(fd);
      setEditingProduct(null);
    });
  }

  function saveEdit() {
    const fd = new FormData();
    fd.set("name",            editDraft.name);
    fd.set("variant",         editDraft.variant);
    fd.set("code",            editDraft.code);
    fd.set("category",        editDraft.category);
    fd.set("type",            editDraft.type);
    fd.set("unitCost",        editDraft.unitCost);
    fd.set("xyloCost",        editDraft.xyloCost);
    fd.set("description",        editDraft.description);
    fd.set("groupDescription",   editDraft.groupDescription);
    fd.set("imageUrl",           editDraft.imageUrl);
    fd.set("groupImageUrl",      editDraft.groupImageUrl);
    fd.set("groupWithVariants",  String(editDraft.groupWithVariants));

    if (isCreating) {
      startSavingEdit(async () => {
        await createProduct(fd);
        setIsCreating(false);
      });
    } else {
      if (!editingProduct) return;
      const supplierChanges = editingProduct.rsProducts
        .filter((rp) => supplierDrafts.get(rp.id) !== rp.supplier)
        .map((rp) => ({ id: rp.id, supplier: supplierDrafts.get(rp.id) ?? rp.supplier }));
      fd.set("id",             editingProduct.id);
      fd.set("supplierChanges", JSON.stringify(supplierChanges));
      startSavingEdit(async () => {
        await updateProduct(fd);
        setEditingProduct(null);
      });
    }
  }

  const set = (field: keyof EditDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setEditDraft((prev) => ({ ...prev, [field]: e.target.value }));

  const allSupplierNames = Array.from(
    new Set(products.flatMap((p) => p.rsProducts.map((rp) => rp.supplier)))
  ).sort();

  // ── Shared toolbar ─────────────────────────────────────────────────────
  const toolbar = stockTakeMode ? (
    <div className="mb-6 flex items-center justify-between rounded-xl border border-amber-700/50 bg-amber-950/20 px-5 py-3">
      <p className="text-sm text-amber-300">
        <span className="font-semibold">Stock Take</span>
        {changedCount > 0
          ? ` — ${changedCount} changed`
          : " — tap to count"}
      </p>
      {/* Desktop save/cancel — hidden on mobile (sticky bar handles it) */}
      <div className="hidden gap-3 md:flex">
        <button
          onClick={cancelStockTake}
          disabled={isSaving}
          className="rounded-lg border border-slate-600 px-4 py-1.5 text-sm font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={() => saveAll(false)}
          disabled={isSaving || changedCount === 0}
          className="rounded-lg bg-amber-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-40"
        >
          {isSaving ? "Saving…" : `Save${changedCount > 0 ? ` (${changedCount})` : ""}`}
        </button>
        <button
          onClick={() => saveAll(true)}
          disabled={isSaving}
          className="rounded-lg bg-green-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-green-600 disabled:opacity-40"
        >
          Done
        </button>
      </div>
    </div>
  ) : (
    <div className="mb-6 flex items-center justify-between">
      <button
        onClick={openNew}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
      >
        + New Product
      </button>
      <button
        onClick={enterStockTake}
        className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
      >
        Stock Take
      </button>
    </div>
  );

  return (
    <>
      {/* ── Stats ── 2-col on mobile, 4-col on desktop ─────────────────── */}
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 md:p-6">
          <p className="text-sm text-slate-400">SKUs</p>
          <p className="mt-1 text-3xl font-bold">{products.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 md:p-6">
          <p className="text-sm text-slate-400">In Stock</p>
          <p className="mt-1 text-3xl font-bold text-green-400">{totalInStock}</p>
          <p className="mt-1 text-xs text-slate-500">
            £{inStockValue.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} value
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 md:p-6">
          <p className="text-sm text-slate-400">GIT</p>
          <p className="mt-1 text-3xl font-bold text-amber-400">{totalGIT}</p>
          <p className="mt-1 text-xs text-slate-500">
            £{gitValue.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} value
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 md:p-6">
          <p className="text-sm text-slate-400">Total Value</p>
          <p className="mt-1 text-3xl font-bold text-white">
            £{stockValue.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-xs text-slate-500">{totalStock} units</p>
        </div>
      </div>

      {/* ── Search ─────────────────────────────────────────────────────── */}
      <div className="mb-4 flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5">
        <svg className="h-4 w-4 shrink-0 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, code or variant…"
          className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none"
        />
        {search && (
          <button onClick={() => setSearch("")} className="text-xs text-slate-500 hover:text-slate-300">
            Clear
          </button>
        )}
        {q && (
          <span className="text-xs text-slate-500">
            {filteredProducts.length} result{filteredProducts.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {toolbar}

      {/* ── Stock take sticky summary (mobile only) ──────────────────────── */}
      {stockTakeMode && (
        <div className="sticky top-0 z-30 -mx-4 mb-4 border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur-sm md:hidden">
          {/* Top row: counted / total · value */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500">Counted</span>
              <span className="text-sm font-bold text-white">{countedProducts}<span className="font-normal text-slate-500">/{products.length}</span></span>
              <span className="text-slate-700">·</span>
              <span className="text-sm font-bold text-green-400">{totalCounted} units</span>
            </div>
            <span className="text-sm font-semibold text-amber-400">
              £{countedValue.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          {/* Category breakdown */}
          {categoryTotals.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {categoryTotals.map((c) => (
                <span key={c.label} className="text-xs text-slate-500">
                  {c.label}: <span className="font-semibold text-slate-300">{c.total}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Mobile card list ─────────────────────────────────────────────── */}
      <div className="block space-y-1 md:hidden">
        {Object.entries(grouped).map(([category, items]) => (
          <div key={category}>
            <p className="px-1 pb-2 pt-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
              {CATEGORY_LABELS[category] ?? category}
            </p>
            <div className="space-y-2">
              {items.map((p) => {
                const currentInStock = getInStock(p);
                const changed = stockTakeMode && (draft[p.id] ?? p.inStock) !== p.inStock;
                const total = currentInStock + p.git;

                return (
                  <div
                    key={p.id}
                    className={`rounded-2xl border p-4 transition-colors ${
                      changed
                        ? "border-amber-500/50 bg-amber-950/25"
                        : "border-slate-700 bg-slate-800"
                    }`}
                  >
                    {/* Product info row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3 min-w-0">
                        {getImageSrc(p.imageUrl) ? (
                          <img
                            src={getImageSrc(p.imageUrl)!}
                            alt={p.name}
                            className="h-10 w-10 shrink-0 rounded-lg border border-slate-700 object-contain bg-white/5"
                          />
                        ) : (
                          <div className="h-10 w-10 shrink-0 rounded-lg border border-slate-800 bg-slate-800/40" />
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-white leading-tight">{p.name}</p>
                            {p.groupWithVariants && (
                              <span className="shrink-0 rounded-full bg-violet-500/20 px-2 py-0.5 text-xs font-semibold text-violet-400">grouped</span>
                            )}
                          </div>
                          {p.variant && (
                            <p className="text-sm text-slate-400 mt-0.5">{p.variant}</p>
                          )}
                          <p className="mt-1 font-mono text-xs text-slate-500">{p.code}</p>
                        </div>
                      </div>

                      {/* Right side: changed badge or edit button */}
                      {stockTakeMode ? (
                        changed && (
                          <span className="shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-400">
                            was {p.inStock}
                          </span>
                        )
                      ) : (
                        <button
                          onClick={() => openEdit(p)}
                          title="Edit product"
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-700 hover:text-white"
                        >
                          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                          </svg>
                        </button>
                      )}
                    </div>

                    {/* Stock controls */}
                    {stockTakeMode ? (
                      <div className="mt-3 flex items-center justify-between gap-3">
                        {/* GIT note */}
                        <div className="text-xs text-slate-500">
                          {p.git > 0 && <span>GIT: <span className="text-amber-400 font-medium">{p.git}</span></span>}
                        </div>

                        {/* +/- stepper */}
                        <div className="flex items-center overflow-hidden rounded-2xl border border-slate-600">
                          <button
                            onClick={() => adjustDraft(p.id, -1, p.inStock)}
                            className="flex h-12 w-12 items-center justify-center text-2xl font-light text-slate-300 transition-colors hover:bg-slate-700 active:bg-slate-600"
                            aria-label="Decrease"
                          >
                            −
                          </button>
                          <div className={`flex h-12 min-w-[3.5rem] items-center justify-center border-x border-slate-600 px-2 ${
                            changed ? "bg-amber-950/40" : ""
                          }`}>
                            <span className={`text-xl font-bold tabular-nums ${changed ? "text-amber-300" : "text-white"}`}>
                              {draft[p.id] ?? p.inStock}
                            </span>
                          </div>
                          <button
                            onClick={() => adjustDraft(p.id, 1, p.inStock)}
                            className="flex h-12 w-12 items-center justify-center text-2xl font-light text-slate-300 transition-colors hover:bg-slate-700 active:bg-slate-600"
                            aria-label="Increase"
                          >
                            +
                          </button>
                        </div>

                        {/* Total with GIT */}
                        <div className="text-right text-xs text-slate-500">
                          {p.git > 0 && (
                            <span>Total: <span className="font-medium text-slate-300">{(draft[p.id] ?? p.inStock) + p.git}</span></span>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* Read mode stock pills */
                      <div className="mt-3 flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-500">Stock</span>
                          <span className={`text-sm font-bold ${p.inStock > 0 ? "text-green-400" : "text-slate-500"}`}>
                            {p.inStock}
                          </span>
                        </div>
                        {p.git > 0 && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-slate-500">GIT</span>
                            <span className="text-sm font-bold text-amber-400">{p.git}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-500">Total</span>
                          <span className={`text-sm font-bold ${total > 0 ? "text-white" : "text-slate-500"}`}>
                            {total}
                          </span>
                        </div>
                        <div className="ml-auto text-xs text-slate-500">
                          £{p.unitCost.toFixed(2)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Bottom padding so sticky bar doesn't overlap last card */}
        {stockTakeMode && <div className="h-28" />}
      </div>

      {/* ── Desktop table ────────────────────────────────────────────────── */}
      <div className="hidden overflow-hidden rounded-2xl border border-slate-700 bg-slate-800 md:block">
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-700 bg-slate-700/50 text-left text-slate-200">
            <tr>
              <th className="px-5 py-3 font-semibold">Product</th>
              <th className="px-5 py-3 font-semibold">Variant / Size</th>
              <th className="px-5 py-3 font-semibold">Code</th>
              <th className="px-5 py-3 font-semibold text-right">Sale Price</th>
              <th className="px-5 py-3 font-semibold text-right">Xylo Cost</th>
              <th className="px-5 py-3 font-semibold text-right">Margin %</th>
              <th className="px-5 py-3 font-semibold text-center">In Stock</th>
              <th className="px-5 py-3 font-semibold text-center">GIT</th>
              <th className="px-5 py-3 font-semibold text-right">Total Stock</th>
              <th className="w-10 px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(grouped).map(([category, items]) => (
              <>
                <tr key={`cat-${category}`} className="border-t border-slate-700 bg-slate-700/30">
                  <td colSpan={10} className="px-5 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    {CATEGORY_LABELS[category] ?? category}
                  </td>
                </tr>
                {items.map((p) => {
                  const currentInStock = getInStock(p);
                  const total   = currentInStock + p.git;
                  const changed = stockTakeMode && (draft[p.id] ?? p.inStock) !== p.inStock;

                  return (
                    <tr
                      key={p.id}
                      className={`group border-t border-slate-700 ${
                        changed ? "bg-amber-950/20" : "hover:bg-slate-700/40"
                      }`}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          {getImageSrc(p.imageUrl) ? (
                            <img
                              src={getImageSrc(p.imageUrl)!}
                              alt=""
                              className="h-9 w-9 shrink-0 rounded-lg border border-slate-700 object-contain bg-white/5"
                            />
                          ) : (
                            <div className="h-9 w-9 shrink-0 rounded-lg border border-slate-800 bg-slate-800/40" />
                          )}
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white">{p.name}</span>
                            {p.groupWithVariants && (
                              <span className="shrink-0 rounded-full bg-violet-500/20 px-2 py-0.5 text-xs font-semibold text-violet-400">grouped</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-300">{p.variant ?? "—"}</td>
                      <td className="px-5 py-3 font-mono text-xs text-slate-400">{p.code}</td>
                      <td className="px-5 py-3 text-right text-slate-200">£{p.unitCost.toFixed(2)}</td>
                      <td className="px-5 py-3 text-right text-slate-300">
                        {p.xyloCost != null ? `£${p.xyloCost.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-5 py-3 text-right font-medium">
                        {p.xyloCost != null && p.unitCost > 0 ? (() => {
                          const margin = ((p.unitCost - p.xyloCost) / p.unitCost) * 100;
                          return (
                            <span className={margin >= 30 ? "text-green-400" : margin >= 15 ? "text-amber-400" : "text-red-400"}>
                              {margin.toFixed(1)}%
                            </span>
                          );
                        })() : <span className="text-slate-500">—</span>}
                      </td>

                      <td className="px-5 py-3">
                        <div className="flex justify-center">
                          {stockTakeMode ? (
                            <input
                              type="number"
                              min="0"
                              value={draft[p.id] ?? p.inStock}
                              onChange={(e) =>
                                setDraft((prev) => ({ ...prev, [p.id]: parseInt(e.target.value) || 0 }))
                              }
                              className={`w-20 rounded border px-2 py-1 text-right text-white outline-none focus:border-amber-400 ${
                                changed ? "border-amber-500 bg-amber-950/40" : "border-slate-500 bg-slate-700"
                              }`}
                            />
                          ) : (
                            <input
                              key={p.id + "-instock"}
                              type="number"
                              min="0"
                              defaultValue={p.inStock}
                              onBlur={(e) => saveRow(p.id, parseInt(e.target.value) || 0, p.git)}
                              className="w-20 rounded border border-slate-500 bg-slate-700 px-2 py-1 text-right text-white outline-none focus:border-green-400"
                            />
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-3">
                        <div className="flex justify-center">
                          {stockTakeMode ? (
                            <span className="inline-block w-20 px-2 py-1 text-right text-slate-400">{p.git}</span>
                          ) : (
                            <input
                              key={p.id + "-git"}
                              type="number"
                              min="0"
                              defaultValue={p.git}
                              onBlur={(e) => saveRow(p.id, p.inStock, parseInt(e.target.value) || 0)}
                              className="w-20 rounded border border-slate-500 bg-slate-700 px-2 py-1 text-right text-white outline-none focus:border-amber-400"
                            />
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-3 text-right font-semibold">
                        <span className={total > 0 ? "text-white" : "text-slate-400"}>{total}</span>
                      </td>

                      <td className="px-3 py-3">
                        {!stockTakeMode && (
                          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <form action={toggleProductVisibility}>
                              <input type="hidden" name="id" value={p.id} />
                              <input type="hidden" name="visible" value={String(p.visibleInOrderForm)} />
                              <button
                                type="submit"
                                title={p.visibleInOrderForm ? "Hide from order form" : "Show in order form"}
                                className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
                                  p.visibleInOrderForm
                                    ? "text-green-400 hover:bg-slate-700"
                                    : "text-slate-600 hover:bg-slate-700 hover:text-green-400"
                                }`}
                              >
                                {p.visibleInOrderForm ? (
                                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                  </svg>
                                ) : (
                                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                    <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                                    <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.064 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                                  </svg>
                                )}
                              </button>
                            </form>
                            <button
                              onClick={() => openEdit(p)}
                              title="Edit product"
                              className="flex h-7 w-7 items-center justify-center rounded text-slate-600 hover:bg-slate-600 hover:text-white"
                            >
                              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Mobile sticky action bar (stock take only) ───────────────────── */}
      {stockTakeMode && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-amber-700/40 bg-slate-950/95 px-4 py-4 backdrop-blur-sm md:hidden">
          <div className="flex gap-3">
            <button
              onClick={() => saveAll(false)}
              disabled={isSaving || changedCount === 0}
              className="flex-1 rounded-xl bg-amber-600 py-3 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-40"
            >
              {isSaving
                ? "Saving…"
                : changedCount > 0
                ? `Save ${changedCount}`
                : "No changes"}
            </button>
            <button
              onClick={() => saveAll(true)}
              disabled={isSaving}
              className="flex-1 rounded-xl bg-green-700 py-3 text-sm font-semibold text-white hover:bg-green-600 disabled:opacity-40"
            >
              {isSaving ? "…" : "Done"}
            </button>
          </div>
        </div>
      )}

      {/* ── Edit modal ───────────────────────────────────────────────────── */}
      {(editingProduct || isCreating) && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-md overflow-y-auto rounded-t-3xl border border-slate-700 bg-slate-900 shadow-2xl sm:max-h-[90vh] sm:rounded-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <div>
                <h2 className="text-base font-bold text-white">{isCreating ? "New product" : "Edit product"}</h2>
                <p className="mt-0.5 font-mono text-xs text-slate-500">{isCreating ? "Fill in the details below" : editingProduct?.code}</p>
              </div>
              <button
                onClick={() => { setEditingProduct(null); setIsCreating(false); }}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {/* Fields */}
            <div className="space-y-4 px-6 py-5">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-400">Name</label>
                <input
                  type="text"
                  value={editDraft.name}
                  onChange={set("name")}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-400">
                  Variant / Size <span className="font-normal text-slate-600">(optional)</span>
                </label>
                <input
                  type="text"
                  value={editDraft.variant}
                  onChange={set("variant")}
                  placeholder="e.g. Blue, 5L, Medium"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500 placeholder:text-slate-600"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-400">
                  Description <span className="font-normal text-slate-600">(shown in order form)</span>
                </label>
                <textarea
                  rows={2}
                  value={editDraft.description}
                  onChange={(e) => setEditDraft((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="e.g. Professional grade, colour-coded for hygiene compliance"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500 placeholder:text-slate-600 resize-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-400">Product Code</label>
                <input
                  type="text"
                  value={editDraft.code}
                  onChange={set("code")}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-sm text-white outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-400">Category</label>
                  <select
                    value={editDraft.category}
                    onChange={set("category")}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-400">Type</label>
                  <select
                    value={editDraft.type}
                    onChange={set("type")}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                  >
                    <option value="CS">CS — Cleaning Supplies</option>
                    <option value="FA">FA — First Aid</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-400">Sale Price (ex VAT)</label>
                  <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 focus-within:border-blue-500">
                    <span className="text-sm text-slate-400">£</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editDraft.unitCost}
                      onChange={set("unitCost")}
                      className="w-full bg-transparent text-sm text-white outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-400">
                    Xylo Cost <span className="font-normal text-slate-600">(optional)</span>
                  </label>
                  <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 focus-within:border-blue-500">
                    <span className="text-sm text-slate-400">£</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editDraft.xyloCost}
                      onChange={set("xyloCost")}
                      placeholder="—"
                      className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
                    />
                  </div>
                </div>
              </div>

              {/* Image */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-400">
                  Product Image
                </label>
                <div className="flex items-center gap-3">
                  {/* Preview */}
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-700 bg-white/5">
                    {getImageSrc(editDraft.imageUrl) ? (
                      <img
                        src={getImageSrc(editDraft.imageUrl)!}
                        alt="preview"
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-600">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6">
                          <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.5"/>
                          <circle cx="8.5" cy="8.5" r="1.5" strokeWidth="1.5"/>
                          <path d="m21 15-5-5L5 21" strokeWidth="1.5"/>
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Upload button */}
                  <div className="flex flex-col gap-1.5">
                    <label className={`cursor-pointer rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                      isUploadingImage
                        ? "border-slate-700 text-slate-500 cursor-not-allowed"
                        : "border-slate-600 text-slate-300 hover:border-slate-400 hover:text-white"
                    }`}>
                      {isUploadingImage ? "Uploading…" : editDraft.imageUrl ? "Replace image" : "Upload image"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={isUploadingImage}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setIsUploadingImage(true);
                          try {
                            const fd = new FormData();
                            fd.set("file", file);
                            const result = await uploadProductImage(fd);
                            if ("url" in result && result.url) {
                              setEditDraft((prev) => ({ ...prev, imageUrl: result.url ?? "" }));
                            } else {
                              alert("Upload failed: " + ("error" in result ? result.error : "Unknown error"));
                            }
                          } catch (err) {
                            console.error("Image upload error:", err);
                            alert("Upload failed: " + (err instanceof Error ? err.message : String(err)));
                          } finally {
                            setIsUploadingImage(false);
                          }
                        }}
                      />
                    </label>
                    {editDraft.imageUrl && (
                      <button
                        type="button"
                        onClick={() => setEditDraft((prev) => ({ ...prev, imageUrl: "" }))}
                        className="text-xs text-slate-500 hover:text-red-400"
                      >
                        Remove image
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Group with variants */}
              <div>
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editDraft.groupWithVariants}
                    onChange={(e) => setEditDraft((prev) => ({ ...prev, groupWithVariants: e.target.checked }))}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-blue-500 accent-blue-500"
                  />
                  <span className="text-sm text-slate-300">Group with variants in order form</span>
                </label>
                <p className="mt-1 ml-7 text-xs text-slate-500">
                  Tick for products like gloves that have multiple sizes/colours — they'll share one card in the order form.
                </p>

                {/* Group description + image — only shown when grouping is on */}
                {editDraft.groupWithVariants && (
                  <div className="mt-4 ml-7 flex flex-col gap-4">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-400">
                        Group description <span className="font-normal text-slate-600">(shown once in the group header)</span>
                      </label>
                      <textarea
                        rows={2}
                        value={editDraft.groupDescription}
                        onChange={(e) => setEditDraft((prev) => ({ ...prev, groupDescription: e.target.value }))}
                        placeholder="e.g. For use with Hygiene Handle 125cm or 137cm"
                        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500 placeholder:text-slate-600 resize-none"
                      />
                    </div>
                  <div>
                    <p className="mb-2 text-xs font-semibold text-slate-400">Group header image</p>
                    <div className="flex items-center gap-3">
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-700 bg-white/5">
                        {getImageSrc(editDraft.groupImageUrl) ? (
                          <img src={getImageSrc(editDraft.groupImageUrl)!} alt="group preview" className="h-full w-full object-contain" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-slate-600 text-xs">None</div>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                          isUploadingImage ? "border-slate-700 text-slate-500 cursor-not-allowed" : "border-slate-600 text-slate-300 hover:border-slate-400 hover:text-white"
                        }`}>
                          {isUploadingImage ? "Uploading…" : editDraft.groupImageUrl ? "Replace group image" : "Upload group image"}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={isUploadingImage}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setIsUploadingImage(true);
                              try {
                                const fd = new FormData();
                                fd.set("file", file);
                                const result = await uploadProductImage(fd);
                                if ("url" in result && result.url) {
                                  setEditDraft((prev) => ({ ...prev, groupImageUrl: result.url ?? "" }));
                                } else {
                                  alert("Upload failed: " + ("error" in result ? result.error : "Unknown error"));
                                }
                              } catch (err) {
                                alert("Upload failed: " + (err instanceof Error ? err.message : String(err)));
                              } finally {
                                setIsUploadingImage(false);
                              }
                            }}
                          />
                        </label>
                        {editDraft.groupImageUrl && (
                          <button type="button" onClick={() => setEditDraft((prev) => ({ ...prev, groupImageUrl: "" }))} className="text-xs text-slate-500 hover:text-red-400">
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  </div>
                )}
              </div>

              {/* Supplier Links */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-400">
                    Supplier Links
                  </label>
                  {!showAddLink && (
                    <button
                      type="button"
                      onClick={() => setShowAddLink(true)}
                      className="text-xs font-semibold text-blue-400 hover:text-blue-300"
                    >
                      + Add link
                    </button>
                  )}
                </div>

                {/* Existing links */}
                {editingProduct && editingProduct.rsProducts.length > 0 && (
                  <div className="mb-2 space-y-2">
                    {editingProduct.rsProducts.map((rp) => (
                      <div key={rp.id} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/60 p-2.5">
                        <input
                          type="text"
                          list="supplier-names"
                          value={supplierDrafts.get(rp.id) ?? rp.supplier}
                          onChange={(e) =>
                            setSupplierDrafts((prev) => new Map(prev).set(rp.id, e.target.value))
                          }
                          className="min-w-0 flex-1 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-white outline-none focus:border-blue-500"
                        />
                        <div className="flex shrink-0 items-center gap-1.5">
                          {rp.rsCode ? (
                            <span className="font-mono text-xs text-slate-400">{rp.rsCode}</span>
                          ) : (
                            <span className="text-xs text-slate-600">no code</span>
                          )}
                          {rp.rsVariant && (
                            <span className="rounded bg-slate-700 px-1.5 py-0.5 text-xs text-slate-300">
                              {rp.rsVariant}
                            </span>
                          )}
                        </div>
                        {supplierDrafts.get(rp.id) !== rp.supplier && (
                          <span className="text-xs text-amber-400">✎</span>
                        )}
                        <button
                          type="button"
                          onClick={() => submitDeleteLink(rp.id)}
                          disabled={isSavingLink}
                          title="Remove link"
                          className="shrink-0 text-slate-600 hover:text-red-400 disabled:opacity-40"
                        >
                          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* No links yet */}
                {(!editingProduct || editingProduct.rsProducts.length === 0) && !showAddLink && (
                  <p className="text-xs text-slate-600">No supplier links yet — click "+ Add link" above.</p>
                )}

                {/* Add new link form */}
                {showAddLink && (
                  <div className="space-y-2 rounded-lg border border-blue-500/30 bg-blue-950/10 p-3">
                    <p className="text-xs font-semibold text-blue-300">New supplier link</p>

                    <input
                      type="text"
                      list="supplier-names"
                      placeholder="Supplier name *"
                      value={linkDraft.supplier}
                      onChange={(e) => setLinkDraft((p) => ({ ...p, supplier: e.target.value }))}
                      className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-white outline-none focus:border-blue-500 placeholder:text-slate-600"
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Supplier code"
                        value={linkDraft.rsCode}
                        onChange={(e) => setLinkDraft((p) => ({ ...p, rsCode: e.target.value }))}
                        className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 font-mono text-xs text-white outline-none focus:border-blue-500 placeholder:text-slate-600"
                      />
                      <input
                        type="text"
                        placeholder="Variant (e.g. BLUE)"
                        value={linkDraft.rsVariant}
                        onChange={(e) => setLinkDraft((p) => ({ ...p, rsVariant: e.target.value }))}
                        className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs text-white outline-none focus:border-blue-500 placeholder:text-slate-600"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        placeholder="Carton size"
                        value={linkDraft.cartonSize}
                        onChange={(e) => setLinkDraft((p) => ({ ...p, cartonSize: e.target.value }))}
                        className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs text-white outline-none focus:border-blue-500 placeholder:text-slate-600"
                      />
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Price/carton (£)"
                        value={linkDraft.cartonPrice}
                        onChange={(e) => setLinkDraft((p) => ({ ...p, cartonPrice: e.target.value }))}
                        className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs text-white outline-none focus:border-blue-500 placeholder:text-slate-600"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAddLink(false)}
                        className="rounded px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={submitAddLink}
                        disabled={isSavingLink || !linkDraft.supplier.trim()}
                        className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-40"
                      >
                        {isSavingLink ? "Saving…" : "Save link"}
                      </button>
                    </div>
                  </div>
                )}

                <datalist id="supplier-names">
                  {allSupplierNames.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </div>

              {/* Bill of Materials */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-400">Bill of Materials</label>
                  {!showAddBom && (
                    <button
                      type="button"
                      onClick={() => setShowAddBom(true)}
                      className="text-xs font-semibold text-emerald-400 hover:text-emerald-300"
                    >
                      + Add component
                    </button>
                  )}
                </div>

                {/* Existing BOM lines */}
                {editingProduct && editingProduct.bomAsComposite.length > 0 && (
                  <div className="mb-2 space-y-1.5">
                    {editingProduct.bomAsComposite.map((line) => (
                      <div key={line.id} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/60 p-2.5">
                        <span className="shrink-0 rounded bg-slate-700 px-1.5 py-0.5 text-xs font-bold text-slate-300">
                          ×{line.qty}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-white leading-tight">
                            {line.component.name}
                            {line.component.variant ? <span className="ml-1 text-slate-400">({line.component.variant})</span> : null}
                          </p>
                          <p className="font-mono text-xs text-slate-500">{line.component.code}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => submitRemoveBomLine(line.id)}
                          disabled={isSavingBom}
                          title="Remove component"
                          className="shrink-0 text-slate-600 hover:text-red-400 disabled:opacity-40"
                        >
                          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {(!editingProduct || editingProduct.bomAsComposite.length === 0) && !showAddBom && (
                  <p className="text-xs text-slate-600">No components — standalone product. Click "+ Add component" to build a BOM.</p>
                )}

                {/* Add component form */}
                {showAddBom && (
                  <div className="space-y-2 rounded-lg border border-emerald-500/30 bg-emerald-950/10 p-3">
                    <p className="text-xs font-semibold text-emerald-300">Add component</p>
                    <select
                      value={bomDraft.componentId}
                      onChange={(e) => setBomDraft((d) => ({ ...d, componentId: e.target.value }))}
                      className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-white outline-none focus:border-emerald-500"
                    >
                      <option value="">— select component product —</option>
                      {products
                        .filter((p) => p.id !== editingProduct?.id)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}{p.variant ? ` (${p.variant})` : ""} — {p.code}
                          </option>
                        ))}
                    </select>
                    <div className="flex items-center gap-3">
                      <label className="shrink-0 text-xs text-slate-400">Qty per unit</label>
                      <input
                        type="number"
                        min="1"
                        value={bomDraft.qty}
                        onChange={(e) => setBomDraft((d) => ({ ...d, qty: e.target.value }))}
                        className="w-20 rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-white outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAddBom(false)}
                        className="rounded px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={submitAddBomLine}
                        disabled={isSavingBom || !bomDraft.componentId}
                        className="rounded bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-40"
                      >
                        {isSavingBom ? "Saving…" : "Add"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Live margin preview */}
              {editDraft.unitCost && editDraft.xyloCost && parseFloat(editDraft.unitCost) > 0 && (() => {
                const sale = parseFloat(editDraft.unitCost);
                const cost = parseFloat(editDraft.xyloCost);
                const margin = ((sale - cost) / sale) * 100;
                return (
                  <p className={`text-xs font-semibold ${margin >= 30 ? "text-green-400" : margin >= 15 ? "text-amber-400" : "text-red-400"}`}>
                    Margin: {margin.toFixed(1)}% · Profit £{(sale - cost).toFixed(2)} per unit
                  </p>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 border-t border-slate-800 px-6 py-4">
              {/* Delete — left side (hidden when creating) */}
              {!isCreating && (!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  disabled={isSavingEdit || isDeletingProduct}
                  className="rounded-lg border border-red-800 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-950 disabled:opacity-40"
                >
                  Delete product
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-red-400">Are you sure?</span>
                  <button
                    onClick={() => {
                      if (!editingProduct) return;
                      startDeletingProduct(async () => {
                        const fd = new FormData();
                        fd.set("id", editingProduct.id);
                        await deleteProduct(fd);
                        setEditingProduct(null);
                        setConfirmDelete(false);
                      });
                    }}
                    disabled={isDeletingProduct}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-40"
                  >
                    {isDeletingProduct ? "Deleting…" : "Yes, delete"}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                </div>
              ))}
              {/* Save — right side */}
              <div className="flex gap-3">
                <button
                  onClick={() => { setEditingProduct(null); setIsCreating(false); }}
                  disabled={isSavingEdit}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  disabled={isSavingEdit || !editDraft.name.trim() || !editDraft.code.trim()}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40"
                >
                  {isSavingEdit ? "Saving…" : isCreating ? "Create product" : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
