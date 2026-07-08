import Link from "next/link";
import { cookies } from "next/headers";
import Logo from "./logo";
import { logout } from "../../app/login/actions";
import { ibsaLogout } from "../../app/ibsa/login/actions";

type SidebarProps = {
  active:
    | "dashboard"
    | "contacts"
    | "lists"
    | "templates"
    | "campaigns"
    | "reports"
    | "settings"
    | "ibsa"
    | "ibsa-products";
};

export default async function Sidebar({ active }: SidebarProps) {
  const cookieStore = await cookies();
  const isMainUser = cookieStore.get("mailfoundry_auth")?.value === "1";
  const isIbsaOnly = !isMainUser && cookieStore.get("ibsa_auth")?.value === "1";

  const base = "block rounded-lg px-3 py-2 text-slate-400 hover:bg-slate-800 hover:text-white";
  const activeClass = "block rounded-lg bg-slate-800 px-3 py-2";

  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-900 p-6">
      <div className="mb-10">
        <Link href={isIbsaOnly ? "/ibsa" : "/dashboard"}>
          <Logo height={26} variant="icon" />
        </Link>
      </div>

      <nav className="space-y-3 text-sm">
        {/* Full MailFoundry nav — only for main users */}
        {!isIbsaOnly && (
          <>
            <Link href="/dashboard" className={active === "dashboard" ? activeClass : base}>
              Dashboard
            </Link>
            <Link href="/contacts" className={active === "contacts" ? activeClass : base}>
              Contacts
            </Link>
            <Link href="/lists" className={active === "lists" ? activeClass : base}>
              Lists
            </Link>
            <Link href="/templates" className={active === "templates" ? activeClass : base}>
              Templates
            </Link>
            <Link href="/campaigns" className={active === "campaigns" ? activeClass : base}>
              Campaigns
            </Link>
            <Link href="/reports" className={active === "reports" ? activeClass : base}>
              Reports
            </Link>
            <Link href="/settings" className={active === "settings" ? activeClass : base}>
              Settings
            </Link>
          </>
        )}

        {/* IBSA section */}
        <div className={isIbsaOnly ? "" : "pt-3"}>
          {!isIbsaOnly && (
            <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-600">
              IBSA · Xylo Supplies
            </p>
          )}
          {isIbsaOnly && (
            <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              IBSA · Xylo Supplies
            </p>
          )}
          <Link href="/ibsa" className={active === "ibsa" ? activeClass : base}>
            Conventions
          </Link>
          <Link
            href="/ibsa/products"
            className={`mt-1 ${active === "ibsa-products" ? activeClass : base}`}
          >
            Products
          </Link>
        </div>
      </nav>

      {/* Logout — uses ibsaLogout for IBSA-only users */}
      {isIbsaOnly ? (
        <form action={ibsaLogout} className="mt-10">
          <button
            type="submit"
            className="w-full rounded-lg border border-slate-700 px-3 py-2 text-left text-sm font-semibold text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            Log out
          </button>
        </form>
      ) : (
        <form action={logout} className="mt-10">
          <button
            type="submit"
            className="w-full rounded-lg border border-slate-700 px-3 py-2 text-left text-sm font-semibold text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            Log out
          </button>
        </form>
      )}
    </aside>
  );
}
