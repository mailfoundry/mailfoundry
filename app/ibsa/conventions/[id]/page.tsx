import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "../../../../src/lib/prisma";
import AppShell from "../../../../src/components/app-shell";
import { updateOrderQty, updateConventionStatus, updateDeliveryDate } from "./actions";

const CATEGORY_LABELS: Record<string, string> = {
  safety_ppe: "Safety & PPE",
  janitorial: "Janitorial",
  chemicals: "Cleaning Chemicals",
  special: "Special Order",
  firstaid: "First Aid",
};

export default async function ConventionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const convention = await prisma.ibsaConvention.findUnique({
    where: { id },
    include: { orderItems: { include: { product: true } } },
  });

  if (!convention) notFound();

  const allProducts = await prisma.ibsaProduct.findMany({
    orderBy: [{ type: "asc" }, { category: "asc" }, { name: "asc" }],
  });

  const qtyMap = new Map<string, number>();
  for (const item of convention.orderItems) {
    qtyMap.set(item.productId, item.qty);
  }

  const csProducts = allProducts.filter((p) => p.type === "CS");
  const faProducts = allProducts.filter((p) => p.type === "FA");

  const totalValue = convention.orderItems.reduce(
    (sum, item) => sum + item.qty * item.product.unitCost,
    0
  );
  const itemsWithQty = convention.orderItems.filter((i) => i.qty > 0).length;

  return (
    <AppShell active="ibsa">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <Link href="/ibsa" className="mb-1 block text-sm text-slate-400 hover:text-white">
            ← All Conventions
          </Link>
          <h2 className="text-3xl font-bold">{convention.name}</h2>
          {convention.venue && <p className="mt-1 text-slate-400">{convention.venue}</p>}
        </div>

        <div className="flex gap-2">
          {(["pending", "ordered", "complete"] as const).map((s) => (
            <form key={s} action={updateConventionStatus}>
              <input type="hidden" name="conventionId" value={convention.id} />
              <input type="hidden" name="status" value={s} />
              <button
                type="submit"
                className={`rounded-lg px-3 py-2 text-sm font-semibold capitalize ${
                  convention.status === s
                    ? "bg-white text-slate-900"
                    : "border border-slate-700 text-slate-400 hover:bg-slate-800"
                }`}
              >
                {s}
              </button>
            </form>
          ))}
        </div>
      </header>

      {/* Key dates & summary */}
      <div className="mb-8 grid grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-xs text-slate-500">Convention Date</p>
          <p className="mt-1 font-semibold">
            {convention.conventionDate.toLocaleDateString("en-GB", {
              weekday: "short",
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="mb-1 text-xs text-slate-500">Delivery Date</p>
          <form action={updateDeliveryDate} className="flex items-center gap-2">
            <input type="hidden" name="conventionId" value={convention.id} />
            <input
              type="date"
              name="date"
              defaultValue={convention.deliveryDate ? convention.deliveryDate.toISOString().split("T")[0] : ""}
              className="w-full bg-transparent text-sm text-white outline-none"
            />
            <button type="submit" className="text-xs text-slate-600 hover:text-slate-300">
              ✓
            </button>
          </form>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-xs text-slate-500">Order Lines</p>
          <p className="mt-1 text-2xl font-bold">{itemsWithQty}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-xs text-slate-500">Order Value (ex VAT)</p>
          <p className="mt-1 text-2xl font-bold">
            £{totalValue.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Cleaning Supplies */}
      <section className="mb-10">
        <h3 className="mb-4 text-lg font-semibold">Cleaning Supplies</h3>
        <ProductTable products={csProducts} qtyMap={qtyMap} conventionId={convention.id} />
      </section>

      {/* First Aid */}
      <section>
        <h3 className="mb-4 text-lg font-semibold">First Aid</h3>
        <ProductTable products={faProducts} qtyMap={qtyMap} conventionId={convention.id} />
      </section>
    </AppShell>
  );
}

function ProductTable({
  products,
  qtyMap,
  conventionId,
}: {
  products: { id: string; name: string; variant: string | null; code: string; unitCost: number; category: string }[];
  qtyMap: Map<string, number>;
  conventionId: string;
}) {
  // Group by category
  const grouped = products.reduce<Record<string, typeof products>>((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            {CATEGORY_LABELS[category] ?? category}
          </p>
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-800 bg-slate-950/50 text-left text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Product</th>
                  <th className="px-5 py-3 font-medium">Variant</th>
                  <th className="px-5 py-3 font-medium text-right">Unit Cost</th>
                  <th className="px-5 py-3 font-medium text-right">Qty</th>
                  <th className="px-5 py-3 font-medium text-right">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => {
                  const qty = qtyMap.get(p.id) ?? 0;
                  const lineTotal = qty * p.unitCost;
                  return (
                    <tr
                      key={p.id}
                      className={`border-t border-slate-800 ${qty === 0 ? "opacity-40 hover:opacity-100" : ""}`}
                    >
                      <td className="px-5 py-3 font-medium text-white">{p.name}</td>
                      <td className="px-5 py-3 text-slate-400">{p.variant ?? "—"}</td>
                      <td className="px-5 py-3 text-right text-slate-400">£{p.unitCost.toFixed(2)}</td>
                      <td className="px-5 py-3 text-right">
                        <form action={updateOrderQty} className="flex items-center justify-end gap-1">
                          <input type="hidden" name="conventionId" value={conventionId} />
                          <input type="hidden" name="productId" value={p.id} />
                          <input
                            type="number"
                            name="qty"
                            min="0"
                            defaultValue={qty || ""}
                            placeholder="0"
                            className="w-20 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-right text-white outline-none focus:border-orange-500"
                          />
                          <button
                            type="submit"
                            className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-600"
                          >
                            ✓
                          </button>
                        </form>
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-slate-300">
                        {lineTotal > 0
                          ? `£${lineTotal.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
