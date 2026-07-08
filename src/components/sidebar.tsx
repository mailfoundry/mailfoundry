import Link from "next/link";
import Logo from "./logo";
import { logout } from "../../app/login/actions";

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

export default function Sidebar({ active }: SidebarProps) {
  const baseLinkClass =
    "block rounded-lg px-3 py-2 text-slate-400 hover:bg-slate-800 hover:text-white";

  const activeLinkClass = "block rounded-lg bg-slate-800 px-3 py-2";

  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-900 p-6">
      <div className="mb-10">
        <Link href="/dashboard">
          <Logo height={26} variant="icon" />
        </Link>
      </div>

      <nav className="space-y-3 text-sm">
        <Link
          href="/dashboard"
          className={active === "dashboard" ? activeLinkClass : baseLinkClass}
        >
          Dashboard
        </Link>

        <Link
          href="/contacts"
          className={active === "contacts" ? activeLinkClass : baseLinkClass}
        >
          Contacts
        </Link>

        <Link
          href="/lists"
          className={active === "lists" ? activeLinkClass : baseLinkClass}
        >
          Lists
        </Link>

        <Link
          href="/templates"
          className={active === "templates" ? activeLinkClass : baseLinkClass}
        >
          Templates
        </Link>

        <Link
          href="/campaigns"
          className={active === "campaigns" ? activeLinkClass : baseLinkClass}
        >
          Campaigns
        </Link>

        <Link
          href="/reports"
          className={active === "reports" ? activeLinkClass : baseLinkClass}
        >
          Reports
        </Link>

        <Link
          href="/settings"
          className={active === "settings" ? activeLinkClass : baseLinkClass}
        >
          Settings
        </Link>

        <div className="pt-3">
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-600">
            IBSA · Xylo Supplies
          </p>
          <Link
            href="/ibsa"
            className={active === "ibsa" ? activeLinkClass : baseLinkClass}
          >
            Conventions
          </Link>
          <Link
            href="/ibsa/products"
            className={`mt-1 ${active === "ibsa-products" ? activeLinkClass : baseLinkClass}`}
          >
            Products
          </Link>
        </div>
      </nav>

      <form action={logout} className="mt-10">
        <button
          type="submit"
          className="w-full rounded-lg border border-slate-700 px-3 py-2 text-left text-sm font-semibold text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          Log out
        </button>
      </form>
    </aside>
  );
}
