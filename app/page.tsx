import Link from "next/link";
import { cookies } from "next/headers";
import Logo from "../src/components/logo";

export default async function HomePage() {
  const cookieStore = await cookies();
  const isMainUser  = cookieStore.get("mailfoundry_auth")?.value === "1";
  const isIbsaUser  = cookieStore.get("ibsa_auth")?.value === "1";
  const isLoggedIn  = isMainUser || isIbsaUser;
  const dashHref    = isMainUser ? "/dashboard" : "/ibsa?type=regional";

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-6">
        <Logo height={38} />
        <Link
          href={isLoggedIn ? dashHref : "/login"}
          className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          {isLoggedIn ? "Portal" : "Sign in"}
        </Link>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-8 pb-24 pt-20 text-center">
        <div className="mb-6 inline-block rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-1.5 text-sm font-medium text-orange-400">
          Convention &amp; congregation supplies
        </div>

        <h1 className="text-5xl font-bold leading-tight tracking-tight sm:text-6xl">
          Supplies for every
          <br />
          <span className="text-orange-400">convention &amp; assembly</span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
          Cleaning supplies and first aid products for regional conventions,
          circuit assemblies, and congregations — ordered in one place and
          fulfilled directly by Xylo (UK) Ltd.
        </p>

        <div className="mt-10">
          <Link
            href="/order"
            className="rounded-xl bg-orange-500 px-8 py-3.5 text-sm font-semibold text-white hover:bg-orange-600 transition-colors"
          >
            Place a group order
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-slate-800 bg-slate-900/50">
        <div className="mx-auto max-w-5xl px-8 py-20">
          <h2 className="mb-12 text-center text-2xl font-bold">
            Everything your event needs
          </h2>

          <div className="grid gap-8 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10">
                <svg className="h-5 w-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-semibold">Simple online ordering</h3>
              <p className="text-sm text-slate-400">
                Submit your convention or congregation order online with a
                clear product list, quantities, and delivery details — no
                phone calls or spreadsheets required.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10">
                <svg className="h-5 w-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-semibold">Full product range</h3>
              <p className="text-sm text-slate-400">
                Cleaning supplies, hygiene products, and first aid equipment —
                all sourced and stocked by Xylo (UK) Ltd specifically for
                IBSA events.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10">
                <svg className="h-5 w-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-semibold">Direct fulfilment</h3>
              <p className="text-sm text-slate-400">
                Orders are picked, packed, and dispatched directly from Xylo
                (UK) Ltd — delivered to your venue or collection point in time
                for your event.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-3xl px-8 py-20 text-center">
        <h2 className="text-3xl font-bold">Ready to place an order?</h2>
        <p className="mt-4 text-slate-400">
          Use the group order form to request supplies for your upcoming
          convention, circuit assembly, or congregation.
        </p>
        <Link
          href="/order"
          className="mt-8 inline-block rounded-xl bg-orange-500 px-8 py-3.5 text-sm font-semibold text-white hover:bg-orange-600 transition-colors"
        >
          Place a group order
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 px-8 py-8 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} Xylo (UK) Ltd ·{" "}
        <a href="https://www.xylouk.co.uk" className="hover:text-slate-400 transition-colors">
          xylouk.co.uk
        </a>
      </footer>
    </main>
  );
}
