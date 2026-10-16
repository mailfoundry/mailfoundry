export const metadata = { title: "SCS product links" };

import Link from "next/link";
import IbsaAppShell from "../../../../src/components/ibsa-app-shell";
import { prisma } from "../../../../src/lib/prisma";
import { findUnlinkedSkus, type UnlinkedSku } from "../../../../src/lib/scs-sync";
import { linkSku, createFromSku } from "./actions";

export const dynamic = "force-dynamic";

const CATEGORIES = [
  { value: "brushes_handles", label: "Brushes & Handles" },
  { value: "mops_buckets", label: "Mops & Buckets" },
  { value: "janitorial", label: "Janitorial" },
  { value: "chemicals", label: "Cleaning Chemicals" },
  { value: "gloves", label: "Gloves" },
  { value: "safety_ppe", label: "Safety & PPE" },
  { value: "hivis", label: "Hi Vis" },
  { value: "special", label: "Special Order" },
  { value: "firstaid", label: "First Aid" },
];

function guessCategory(name: string): string {
  const n = name.toLowerCase();
  if (/broom|brush|handle|squeegee|scraper/.test(n)) return "brushes_handles";
  if (/mop|bucket|wringer/.test(n)) return "mops_buckets";
  if (/glove/.test(n)) return "gloves";
  if (/hi.?vis|vest/.test(n)) return "hivis";
  return "janitorial";
}
// Supplier code guess from the SKU, e.g. RS_BROOM_STIFF_30CM_104948_GREEN → 104948
const guessCode = (sku: string) => sku.match(/(\d{5,})/)?.[1] ?? "";
const cleanName = (s: string) => s.replace(/^Robert Scott\s*[-–—]?\s*/i, "").trim();

const inputCls = "w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-900";

export default async function ScsLinksPage({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  const { done } = await searchParams;

  let unlinked: UnlinkedSku[] = [];
  let error: string | null = null;
  try {
    unlinked = await findUnlinkedSkus(90);
  } catch (e) {
    error = e instanceof Error ? e.message : "Couldn't load SCS orders";
  }

  const [products, suppliers, aliases] = await Promise.all([
    prisma.ibsaProduct.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }, { variant: "asc" }],
      select: { id: true, name: true, variant: true, code: true, category: true },
    }),
    prisma.ibsaSupplier.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
    prisma.ibsaSkuAlias.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { sku: true, product: { select: { name: true, variant: true, code: true } } },
    }),
  ]);
  const catLabel = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]));

  return (
    <IbsaAppShell active="ibsa-purchasing">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Purchasing</p>
          <h2 className="text-3xl font-bold">SCS product links</h2>
          <p className="mt-1 text-sm text-gray-500">
            SCS website products whose SKU doesn&apos;t match an IBSA product yet. Link each one to the IBSA product it really is,
            or add it as a new IBSA product. Undispatched SCS orders pick up the missing lines immediately.
          </p>
        </div>
        <Link href="/ibsa/purchasing" className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100">
          Back to Purchasing
        </Link>
      </header>

      {done && <p className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">✓ {done}</p>}
      {error && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {!error && unlinked.length === 0 && (
        <p className="rounded-2xl border border-dashed border-gray-200 p-10 text-center text-sm text-gray-400">
          Everything sold on SCS in the last 90 days is linked to IBSA stock. 🎉
        </p>
      )}

      <div className="space-y-4">
        {unlinked.map((u) => (
          <div key={u.sku} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="font-semibold text-gray-900">{u.productName}{u.variant ? <span className="text-gray-500"> — {u.variant}</span> : null}</p>
                <p className="font-mono text-xs text-gray-400">{u.sku}</p>
              </div>
              <p className="text-xs text-gray-500">
                {u.totalQty} sold · order{u.orders.length === 1 ? "" : "s"} {u.orders.map((n) => `#${n}`).join(", ")}
                {u.costPrice != null ? ` · SCS cost £${u.costPrice.toFixed(2)}` : ""}
              </p>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {/* Option A: link to existing */}
              <form action={linkSku} className="rounded-xl bg-gray-50 p-4">
                <input type="hidden" name="sku" value={u.sku} />
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">A · Same as an existing IBSA product</p>
                <select name="productId" required defaultValue="" className={inputCls}>
                  <option value="" disabled>Choose product…</option>
                  {CATEGORIES.map((c) => {
                    const inCat = products.filter((p) => p.category === c.value);
                    return inCat.length ? (
                      <optgroup key={c.value} label={c.label}>
                        {inCat.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}{p.variant ? ` — ${p.variant}` : ""} ({p.code})</option>
                        ))}
                      </optgroup>
                    ) : null;
                  })}
                  {products.filter((p) => !catLabel[p.category]).length > 0 && (
                    <optgroup label="Other">
                      {products.filter((p) => !catLabel[p.category]).map((p) => (
                        <option key={p.id} value={p.id}>{p.name}{p.variant ? ` — ${p.variant}` : ""} ({p.code})</option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <button type="submit" className="mt-3 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-700">Link</button>
              </form>

              {/* Option B: create new */}
              <form action={createFromSku} className="rounded-xl bg-orange-50/60 p-4">
                <input type="hidden" name="sku" value={u.sku} />
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">B · Add as a new IBSA product</p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="col-span-2 text-[11px] text-gray-500">Name
                    <input name="name" defaultValue={cleanName(u.productName)} required className={inputCls} />
                  </label>
                  <label className="text-[11px] text-gray-500">Variant
                    <input name="variant" defaultValue={u.variant ?? ""} className={inputCls} />
                  </label>
                  <label className="text-[11px] text-gray-500">Category
                    <select name="category" defaultValue={guessCategory(u.productName)} className={inputCls}>
                      {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </label>
                  <label className="text-[11px] text-gray-500">Supplier
                    <input name="supplier" list="ibsa-suppliers" defaultValue={u.supplierGuess} className={inputCls} />
                  </label>
                  <label className="text-[11px] text-gray-500">Supplier code
                    <input name="rsCode" defaultValue={guessCode(u.sku)} className={inputCls} />
                  </label>
                  <label className="text-[11px] text-gray-500">Unit cost £ (ex VAT)
                    <input name="unitCost" type="number" step="0.01" min="0" defaultValue={u.costPrice ?? ""} className={inputCls} />
                  </label>
                  <label className="text-[11px] text-gray-500">Units per carton
                    <input name="cartonSize" type="number" min="1" defaultValue={1} className={inputCls} />
                  </label>
                </div>
                <button type="submit" className="mt-3 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600">Add to IBSA</button>
              </form>
            </div>
          </div>
        ))}
      </div>

      <datalist id="ibsa-suppliers">
        {suppliers.map((s) => <option key={s.name} value={s.name} />)}
      </datalist>

      {aliases.length > 0 && (
        <div className="mt-10">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">Linked SKUs</h3>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-left text-sm">
              <tbody className="divide-y divide-gray-50">
                {aliases.map((a) => (
                  <tr key={a.sku}>
                    <td className="px-4 py-2 font-mono text-xs text-gray-500">{a.sku}</td>
                    <td className="px-4 py-2 text-gray-700">→ {a.product.name}{a.product.variant ? ` — ${a.product.variant}` : ""} <span className="text-xs text-gray-400">({a.product.code})</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </IbsaAppShell>
  );
}
