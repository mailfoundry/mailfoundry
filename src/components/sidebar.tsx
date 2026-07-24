"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
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
    | "ibsa-circuits"
    | "ibsa-congregations"
    | "ibsa-products"
    | "ibsa-purchasing"
    | "ibsa-suppliers"
    | "ibsa-orders"
    | "ibsa-contacts"
    | "ibsa-tools";
  /** True when the logged-in user has IBSA credentials only (no MailFoundry access) */
  ibsaOnly?: boolean;
  /** True when the main MailFoundry user is viewing an IBSA page */
  isMainUser?: boolean;
  orderCounts?: { regional: number; circuit: number; congregation: number };
};

const ibsaActive = new Set([
  "ibsa", "ibsa-circuits", "ibsa-congregations",
  "ibsa-products", "ibsa-purchasing", "ibsa-suppliers",
  "ibsa-orders", "ibsa-contacts", "ibsa-tools",
]);

export default function Sidebar({ active, ibsaOnly = false, isMainUser = false, orderCounts }: SidebarProps) {
  const base        = "block rounded-lg px-3 py-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors";
  const activeClass = "block rounded-lg bg-slate-800 px-3 py-2 text-white font-semibold";
  const inIbsa      = ibsaActive.has(active);

  const badge = (n: number) =>
    n > 0
      ? <span className="ml-auto rounded-full bg-orange-500 px-2 py-0.5 text-xs font-bold text-white tabular-nums">{n}</span>
      : null;

  const [productsHref, setProductsHref] = useState("/ibsa/products?type=CS");
  useEffect(() => {
    const saved = localStorage.getItem("ibsa-products-tab");
    setProductsHref(saved === "FA" ? "/ibsa/products?type=FA" : "/ibsa/products?type=CS");
  }, []);

  /* ── IBSA sidebar ──────────────────────────────────────────────── */
  if (inIbsa || ibsaOnly) {
    return (
      <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col overflow-y-auto border-r border-slate-800 bg-slate-900 p-6">
        <div className="mb-8">
          <Link href="/ibsa?type=regional">
            <Logo height={26} variant="icon" />
          </Link>
        </div>

        {/* Back to MailFoundry — only for the main user */}
        {isMainUser && (
          <Link
            href="/dashboard"
            className="mb-6 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            MailFoundry
          </Link>
        )}

        <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Xylo (UK) Ltd
        </p>

        <nav className="flex-1 space-y-1 text-sm">
          <Link href="/ibsa?type=regional" className={`flex items-center justify-between ${active === "ibsa" ? activeClass : base}`}>
            <span>Regionals</span>{badge(orderCounts?.regional ?? 0)}
          </Link>
          <Link href="/ibsa?type=circuit" className={`flex items-center justify-between ${active === "ibsa-circuits" ? activeClass : base}`}>
            <span>Circuit Assemblies</span>{badge(orderCounts?.circuit ?? 0)}
          </Link>
          <Link href="/ibsa?type=congregation" className={`flex items-center justify-between ${active === "ibsa-congregations" ? activeClass : base}`}>
            <span>Congregations</span>{badge(orderCounts?.congregation ?? 0)}
          </Link>

          <div className="my-3 border-t border-slate-800" />

          <Link href={productsHref} className={active === "ibsa-products" ? activeClass : base}>Products</Link>
          <Link href="/ibsa/purchasing" className={active === "ibsa-purchasing" ? activeClass : base}>Purchasing</Link>
          <Link href="/ibsa/suppliers" className={active === "ibsa-suppliers" ? activeClass : base}>Suppliers</Link>
          <Link href="/ibsa/contacts" className={active === "ibsa-contacts" ? activeClass : base}>Contacts</Link>

          <div className="my-3 border-t border-slate-800" />

          <Link href="/ibsa/tools" className={active === "ibsa-tools" ? activeClass : base}>Tools</Link>
        </nav>

        {/* Footer: logout for IBSA-only users; nothing for main user (they use ← MailFoundry) */}
        {ibsaOnly && (
          <form action={ibsaLogout} className="mt-6">
            <button type="submit" className="w-full rounded-lg border border-slate-700 px-3 py-2 text-left text-sm text-slate-400 hover:bg-slate-800 hover:text-white">
              Log out
            </button>
          </form>
        )}
      </aside>
    );
  }

  /* ── MailFoundry sidebar ───────────────────────────────────────── */
  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col overflow-y-auto border-r border-slate-800 bg-slate-900 p-6">
      <div className="mb-10">
        <Link href="/dashboard">
          <Logo height={26} variant="icon" />
        </Link>
      </div>

      <nav className="flex-1 space-y-1 text-sm">
        <Link href="/dashboard"  className={active === "dashboard"  ? activeClass : base}>Dashboard</Link>
        <Link href="/contacts"   className={active === "contacts"   ? activeClass : base}>Contacts</Link>
        <Link href="/lists"      className={active === "lists"      ? activeClass : base}>Lists</Link>
        <Link href="/templates"  className={active === "templates"  ? activeClass : base}>Templates</Link>
        <Link href="/campaigns"  className={active === "campaigns"  ? activeClass : base}>Campaigns</Link>
        <Link href="/reports"    className={active === "reports"    ? activeClass : base}>Reports</Link>
        <Link href="/settings"   className={active === "settings"   ? activeClass : base}>Settings</Link>

        <div className="my-3 border-t border-slate-800" />

        <Link
          href="/ibsa?type=regional"
          className="flex items-center justify-between rounded-lg px-3 py-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors text-sm"
        >
          <span>Xylo Ordering</span>
          <svg className="h-3.5 w-3.5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
        <Link href="/ibsa/tools" className={base}>Tools</Link>
      </nav>

      <form action={logout} className="mt-6">
        <button type="submit" className="w-full rounded-lg border border-slate-700 px-3 py-2 text-left text-sm text-slate-400 hover:bg-slate-800 hover:text-white">
          Log out
        </button>
      </form>
    </aside>
  );
}
