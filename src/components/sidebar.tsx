import Link from "next/link";
import { logout } from "../../app/login/actions";

type SidebarProps = {
  active:
    | "dashboard"
    | "contacts"
    | "lists"
    | "campaigns"
    | "reports"
    | "settings";
};

export default function Sidebar({ active }: SidebarProps) {
  const baseLinkClass =
    "block rounded-lg px-3 py-2 text-slate-400 hover:bg-slate-800 hover:text-white";

  const activeLinkClass = "block rounded-lg bg-slate-800 px-3 py-2";

  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-900 p-6">
      <div className="mb-10">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
          Internal Build V1
        </p>
        <Link href="/" className="mt-3 block text-2xl font-bold">
          MailFoundry
        </Link>
      </div>

      <nav className="space-y-3 text-sm">
        <Link
          href="/"
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

        <div className="rounded-lg px-3 py-2 text-slate-400">Templates</div>
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
