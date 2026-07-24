import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import Logo from "../../src/components/logo";
import { prisma } from "../../src/lib/prisma";
import { accountLogout, reorder } from "./actions";

export const metadata = { title: "My Account — Xylo (UK) Ltd" };
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, { label: string; colour: string }> = {
  submitted:  { label: "Submitted",  colour: "text-sky-400 bg-sky-400/10" },
  processing: { label: "Processing", colour: "text-amber-400 bg-amber-400/10" },
  complete:   { label: "Complete",   colour: "text-green-400 bg-green-400/10" },
  cancelled:  { label: "Cancelled",  colour: "text-slate-500 bg-slate-500/10" },
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
    // Stale cookie
    jar.delete("group_auth");
    redirect("/account/login");
  }

  const params = await searchParams;
  const reordered = params.reordered === "1";
  const notFound = params.error === "not-found";

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Nav */}
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <Logo height={28} />
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-400">{account.groupName}</span>
          <form action={accountLogout}>
            <button type="submit" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
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
          <h1 className="text-2xl font-black tracking-tight">{account.groupName}</h1>
          <p className="mt-1 text-sm text-slate-400">{account.contactEmail}</p>
        </div>

        {/* Banners */}
        {reordered && (
          <div className="mb-6 rounded-xl border border-green-800 bg-green-900/20 px-5 py-4 text-sm text-green-400">
            Re-order submitted — we&apos;ll be in touch to confirm.
          </div>
        )}
        {notFound && (
          <div className="mb-6 rounded-xl border border-red-800 bg-red-900/20 px-5 py-4 text-sm text-red-400">
            Order not found.
          </div>
        )}

        {/* Orders */}
        {account.orders.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-10 text-center">
            <p className="text-slate-400 text-sm mb-4">No orders yet.</p>
            <Link
              href="/order"
              className="inline-block rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-bold text-white hover:bg-orange-600 transition-colors"
            >
              Place your first order
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {account.orders.map((order, i) => {
              const status = STATUS_LABEL[order.status] ?? STATUS_LABEL.submitted;
              const date = order.submittedAt.toLocaleDateString("en-GB", {
                day: "numeric", month: "short", year: "numeric",
              });
              const csCount = order.lines.filter((l) => l.dept === "CS").reduce((s, l) => s + l.qty, 0);
              const faCount = order.lines.filter((l) => l.dept === "FA").reduce((s, l) => s + l.qty, 0);

              return (
                <div key={order.id} className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                  {/* Order header */}
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.colour}`}>
                          {status.label}
                        </span>
                        {i === 0 && (
                          <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-orange-400 bg-orange-400/10">
                            Latest
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">{date}</p>
                    </div>
                    <form action={reorder.bind(null, order.id)}>
                      <button
                        type="submit"
                        className="shrink-0 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                      >
                        Re-order
                      </button>
                    </form>
                  </div>

                  {/* Line summary */}
                  <div className="space-y-1">
                    {order.lines.map((l) => (
                      <div key={l.id} className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">
                          {l.product.name}
                          {l.product.variant && (
                            <span className="text-slate-600"> ({l.product.variant})</span>
                          )}
                        </span>
                        <span className="tabular-nums font-semibold text-slate-300 ml-4">
                          ×{l.qty}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Totals strip */}
                  <div className="mt-4 pt-3 border-t border-slate-800 flex gap-4 text-xs text-slate-500">
                    {csCount > 0 && <span>{csCount} cleaning item{csCount !== 1 ? "s" : ""}</span>}
                    {faCount > 0 && <span>{faCount} first aid item{faCount !== 1 ? "s" : ""}</span>}
                    {order.deliveryAddress && (
                      <span className="ml-auto truncate max-w-[200px]">{order.deliveryAddress.split("\n")[0]}</span>
                    )}
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
