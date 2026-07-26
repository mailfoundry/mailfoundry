import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import Logo from "../../src/components/logo";
import { prisma } from "../../src/lib/prisma";
import { accountLogout } from "./actions";
import ReorderForm from "./ReorderForm";

export const metadata = { title: "My Account — Xylo (UK) Ltd" };
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, { label: string; colour: string }> = {
  submitted:  { label: "Submitted",  colour: "text-sky-700 bg-sky-100" },
  processing: { label: "Processing", colour: "text-amber-700 bg-amber-100" },
  complete:   { label: "Complete",   colour: "text-green-700 bg-green-100" },
  cancelled:  { label: "Cancelled",  colour: "text-gray-500 bg-gray-100" },
};

type Props = { searchParams: Promise<{ reordered?: string; error?: string }> };

export default async function AccountPage({ searchParams }: Props) {
  const jar = await cookies();
  const groupAccountId = jar.get("group_auth")?.value;
  if (!groupAccountId) redirect("/account/login");

  const account = await prisma.groupAccount.findUnique({
    where: { id: groupAccountId },
    include: {
      orders: {
        orderBy: { submittedAt: "desc" },
        include: { lines: { include: { product: true } } },
      },
    },
  });

  if (!account) {
    jar.delete("group_auth");
    redirect("/account/login");
  }

  const params = await searchParams;
  const reordered = params.reordered === "1";
  const notFound = params.error === "not-found";

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Nav */}
      <header className="border-b border-gray-200 bg-white px-6 py-4 flex items-center justify-between">
        <Logo height={28} />
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{account.groupName}</span>
          <form action={accountLogout}>
            <button type="submit" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-500 mb-1">
            Your account
          </p>
          <h1 className="text-2xl font-black tracking-tight text-gray-900">{account.groupName}</h1>
          <p className="mt-1 text-sm text-gray-500">{account.contactEmail}</p>
        </div>

        {/* Banners */}
        {reordered && (
          <div className="mb-6 rounded-xl border border-green-300 bg-green-50 px-5 py-4 text-sm text-green-700">
            Re-order submitted — we&apos;ll be in touch to confirm.
          </div>
        )}
        {notFound && (
          <div className="mb-6 rounded-xl border border-red-300 bg-red-50 px-5 py-4 text-sm text-red-600">
            Order not found.
          </div>
        )}

        {/* Orders */}
        {account.orders.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-10 text-center">
            <p className="text-gray-400 text-sm mb-4">No orders yet.</p>
            <Link
              href="/order"
              className="inline-block rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-bold text-white hover:bg-orange-600 transition-colors"
            >
              Place your first order
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {account.orders.map((order, i) => {
              const status = STATUS_LABEL[order.status] ?? STATUS_LABEL.submitted;
              const date = order.submittedAt.toLocaleDateString("en-GB", {
                day: "numeric", month: "long", year: "numeric",
              });
              const csLines = order.lines.filter((l) => l.dept === "CS");
              const faLines = order.lines.filter((l) => l.dept === "FA");
              const fmtGbp = (n: number) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
              const lineTotal = (lines: typeof csLines) => lines.reduce((s, l) => s + l.qty * l.product.unitCost, 0);
              const grandTotal = lineTotal(order.lines);

              const SectionTable = ({ lines, label }: { lines: typeof csLines; label: string }) =>
                lines.length === 0 ? null : (
                  <div className="mb-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">{label}</p>
                    <div className="overflow-hidden rounded-lg border border-gray-200">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400">Product</th>
                            <th className="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-400 w-10">Qty</th>
                            <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-400 w-16">Unit</th>
                            <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-400 w-20">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lines.map((l) => (
                            <tr key={l.id} className="border-t border-gray-100">
                              <td className="px-3 py-2.5 text-gray-700">
                                {l.product.name}
                                {l.product.variant && (
                                  <span className="block text-[11px] text-gray-400">{l.product.variant}</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-center font-bold text-gray-900">{l.qty}</td>
                              <td className="px-3 py-2.5 text-right text-gray-500 tabular-nums">{fmtGbp(l.product.unitCost)}</td>
                              <td className="px-3 py-2.5 text-right font-semibold text-gray-900 tabular-nums">{fmtGbp(l.qty * l.product.unitCost)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-gray-200">
                            <td colSpan={3} className="px-3 py-2 text-right text-xs text-gray-400">Section total</td>
                            <td className="px-3 py-2 text-right font-bold text-orange-500 tabular-nums">{fmtGbp(lineTotal(lines))}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                );

              return (
                <div key={order.id} className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
                  {/* Order header */}
                  <div className="flex items-start justify-between gap-4 mb-5">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.colour}`}>
                          {status.label}
                        </span>
                        {i === 0 && (
                          <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-orange-600 bg-orange-100">
                            Latest
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">{date}</p>
                      {order.requiredBy && (
                        <p className="text-xs text-gray-400 mt-0.5">Required by: <span className="text-gray-600">{order.requiredBy}</span></p>
                      )}
                      {order.deliveryAddress && (
                        <p className="text-xs text-gray-400 mt-0.5">Delivery: <span className="text-gray-600">{order.deliveryAddress.split("\n")[0]}</span></p>
                      )}
                    </div>
                    <ReorderForm orderId={order.id} defaultAddress={order.deliveryAddress ?? ""} />
                  </div>

                  {/* Line items */}
                  <SectionTable lines={csLines} label="Cleaning Supplies" />
                  <SectionTable lines={faLines} label="First Aid" />

                  {/* Grand total */}
                  <div className="mt-2 flex justify-end">
                    <div className="flex items-center gap-6 rounded-lg bg-gray-50 border border-gray-200 px-4 py-2.5">
                      <span className="text-xs text-gray-400">Order total</span>
                      <span className="text-base font-black text-orange-500 tabular-nums">{fmtGbp(grandTotal)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 text-center">
          <Link
            href="/order"
            className="inline-block rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-bold text-white hover:bg-orange-600 transition-colors"
          >
            Place a new order
          </Link>
        </div>
      </main>
    </div>
  );
}
