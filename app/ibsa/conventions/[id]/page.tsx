import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "../../../../src/lib/prisma";
import AppShell from "../../../../src/components/app-shell";
import { updateConventionStatus, updateDeliveryDate, updateShippingCost } from "./actions";
import ConventionQtyInput from "./ConventionQtyInput";

const CATEGORY_LABELS: Record<string, string> = {
  safety_ppe: "Safety & PPE",
  janitorial: "Janitorial",
  chemicals: "Cleaning Chemicals",
  special: "Special Order",
  firstaid: "First Aid",
};

const fmtGbp = (n: number) =>
  n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

  const orderSaleTotal = convention.orderItems.reduce(
    (sum, item) => sum + item.qty * item.product.unitCost, 0
  );
  const orderCostTotal = convention.orderItems.reduce(
    (sum, item) => sum + item.qty * (item.product.xyloCost ?? item.product.unitCost), 0
  );
  const orderProfit = orderSaleTotal - orderCostTotal;
  const orderMarginPct = orderSaleTotal > 0 ? (orderProfit / orderSaleTotal) * 100 : 0;
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

      {/* Stats — 2 rows of 3 */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        {/* Row 1 */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-xs text-slate-500">Convention Date</p>
          <p className="mt-1 font-semibold">
            {convention.conventionDate.toLocaleDateString("en-GB", {
              weekday: "short", day: "numeric", month: "short", year: "numeric",
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
            <button type="submit" className="text-xs text-slate-600 hover:text-slate-300">✓</button>
          </form>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="mb-1 text-xs text-slate-500">Shipping Cost</p>
          <form action={updateShippingCost} className="flex items-center gap-1">
            <input type="hidden" name="conventionId" value={convention.id} />
            <span className="text-sm text-slate-400">£</span>
            <input
              type="number"
              name="shippingCost"
              min="0"
              step="0.01"
              defaultValue={convention.shippingCost > 0 ? convention.shippingCost : ""}
              placeholder="0.00"
              className="w-full bg-transparent text-sm text-white outline-none"
            />
            <button type="submit" className="text-xs text-slate-600 hover:text-slate-300">✓</button>
          </form>
        </div>

        {/* Row 2 */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-xs text-slate-500">Order Lines</p>
          <p className="mt-1 text-2xl font-bold">{itemsWithQty}</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-xs text-slate-500">Order Value (ex VAT)</p>
          <p className="mt-1 text-2xl font-bold">£{fmtGbp(orderSaleTotal)}</p>
          {convention.shippingCost > 0 && (
            <p className="mt-0.5 text-xs text-slate-500">+ £{fmtGbp(convention.shippingCost)} shipping</p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-xs text-slate-500">Order Profit</p>
          <p className={`mt-1 text-2xl font-bold ${orderProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
            £{fmtGbp(orderProfit)}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">{orderMarginPct.toFixed(1)}% margin</p>
        </div>
      </div>

      <section className="mb-10">
        <h3 className="mb-4 text-lg font-semibold">Cleaning Supplies</h3>
        <ProductTable products={csProducts} qtyMap={qtyMap} conventionId={convention.id} />
      </section>

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
  products: {
    id: string;
    name: string;
    variant: string | null;
    unitCost: number;
    xyloCost: number | null;
    category: string;
  }[];
  qtyMap: Map<string, number>;
  conventionId: string;
}) {
  const grouped = products.reduce<Record<string, typeof products>>((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            {CATEGORY_LABELS[category] ?? category}
          </p>
          <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-700 bg-slate-700/50 text-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Product</th>
                  <th className="px-4 py-3 text-left font-semibold">Variant</th>
                  <th className="px-4 py-3 text-right font-semibold">Sale</th>
                  <th className="px-4 py-3 text-right font-semibold">Cost</th>
                  <th className="px-4 py-3 text-center font-semibold">Qty</th>
                  <th className="px-4 py-3 text-right font-semibold">Line Sale</th>
                  <th className="px-4 py-3 text-right font-semibold">Margin £</th>
                  <th className="px-4 py-3 text-right font-semibold">Margin %</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => {
                  const qty = qtyMap.get(p.id) ?? 0;
                  const xyloCost = p.xyloCost ?? p.unitCost;
                  const lineSale = qty * p.unitCost;
                  const lineMarginGbp = qty * (p.unitCost - xyloCost);
                  const marginPct = p.unitCost > 0 ? ((p.unitCost - xyloCost) / p.unitCost) * 100 : 0;
                  const marginColour = marginPct >= 30 ? "text-green-400" : marginPct >= 15 ? "text-amber-400" : "text-red-400";

                  return (
                    <tr
                      key={p.id}
                      className={`border-t border-slate-700 hover:bg-slate-700/30 transition-opacity ${
                        qty === 0 ? "opacity-40 hover:opacity-100" : ""
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-white">{p.name}</td>
                      <td className="px-4 py-3 text-slate-300">{p.variant ?? "—"}</td>
                      <td className="px-4 py-3 text-right text-slate-200">£{p.unitCost.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-slate-400">£{xyloCost.toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center">
                          <ConventionQtyInput conventionId={conventionId} productId={p.id} qty={qty} />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-200">
                        {lineSale > 0 ? `£${fmtGbp(lineSale)}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {qty > 0 ? (
                          <span className={lineMarginGbp >= 0 ? "text-green-400" : "text-red-400"}>
                            £{fmtGbp(lineMarginGbp)}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={marginColour}>{marginPct.toFixed(1)}%</span>
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
