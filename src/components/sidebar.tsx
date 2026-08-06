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
    | "ibsa-pos"
    | "ibsa-suppliers"
    | "ibsa-orders"
    | "ibsa-contacts"
    | "ibsa-tools";
  ibsaOnly?: boolean;
  isMainUser?: boolean;
  orderCounts?: { regional: number; circuit: number; congregation: number };
};

const ibsaActive = new Set([
  "ibsa", "ibsa-circuits", "ibsa-congregations",
  "ibsa-products", "ibsa-purchasing", "ibsa-pos", "ibsa-suppliers",
  "ibsa-orders", "ibsa-contacts", "ibsa-tools",
]);

export default function Sidebar({ active, ibsaOnly = false, isMainUser = false, orderCounts }: SidebarProps) {
  const base        = "block rounded-lg px-3 py-2.5 text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors";
  const activeClass = "block rounded-lg bg-gray-100 px-3 py-2.5 text-gray-900 font-semibold";
  const inIbsa      = ibsaActive.has(active);

  const [mobileOpen, setMobileOpen] = useState(false);

  // Close drawer on route change (next navigation)
  useEffect(() => {
    setMobileOpen(false);
  }, [active]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const badge = (n: number) =>
    n > 0
      ? <span className="ml-auto rounded-full bg-orange-500 px-2 py-0.5 text-xs font-bold text-white tabular-nums">{n}</span>
      : null;

  const [productsHref, setProductsHref] = useState("/ibsa/products?type=CS");
  useEffect(() => {
    const saved = localStorage.getItem("ibsa-products-tab");
    setProductsHref(saved === "FA" ? "/ibsa/products?type=FA" : "/ibsa/products?type=CS");
  }, []);

  /* ── Hamburger icon ─────────────────────────────────────────────── */
  const HamburgerIcon = () => (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );

  const CloseIcon = () => (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );

  /* ── IBSA nav content (shared between desktop sidebar & mobile drawer) ── */
  const IbsaNav = ({ onClose }: { onClose?: () => void }) => (
    <>
      <div className="mb-8 flex items-center justify-between">
        <Link href="/ibsa?type=regional" onClick={onClose}>
          <Logo height={26} variant="icon" />
        </Link>
        {onClose && (
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors lg:hidden">
            <CloseIcon />
          </button>
        )}
      </div>

      {isMainUser && (
        <Link
          href="/dashboard"
          onClick={onClose}
          className="mb-6 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          MailFoundry
        </Link>
      )}

      <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
        Xylo (UK) Ltd
      </p>

      <nav className="flex-1 space-y-1 text-sm">
        <Link href="/ibsa?type=regional" onClick={onClose} className={`flex items-center justify-between ${active === "ibsa" ? activeClass : base}`}>
          <span>Regionals</span>{badge(orderCounts?.regional ?? 0)}
        </Link>
        <Link href="/ibsa?type=circuit" onClick={onClose} className={`flex items-center justify-between ${active === "ibsa-circuits" ? activeClass : base}`}>
          <span>Circuit Assemblies</span>{badge(orderCounts?.circuit ?? 0)}
        </Link>
        <Link href="/ibsa?type=congregation" onClick={onClose} className={`flex items-center justify-between ${active === "ibsa-congregations" ? activeClass : base}`}>
          <span>Congregations</span>{badge(orderCounts?.congregation ?? 0)}
        </Link>

        <div className="my-3 border-t border-gray-200" />

        <Link href={productsHref} onClick={onClose} className={active === "ibsa-products" ? activeClass : base}>Products</Link>
        <Link href="/ibsa/purchasing" onClick={onClose} className={active === "ibsa-purchasing" ? activeClass : base}>Purchasing</Link>
        <Link href="/ibsa/pos" onClick={onClose} className={active === "ibsa-pos" ? activeClass : base}>Purchase Orders</Link>
        <Link href="/ibsa/suppliers" onClick={onClose} className={active === "ibsa-suppliers" ? activeClass : base}>Suppliers</Link>
        <Link href="/ibsa/contacts" onClick={onClose} className={active === "ibsa-contacts" ? activeClass : base}>Contacts</Link>

        <div className="my-3 border-t border-gray-200" />

        <Link href="/ibsa/tools" onClick={onClose} className={active === "ibsa-tools" ? activeClass : base}>Tools</Link>
      </nav>

      {ibsaOnly && (
        <form action={ibsaLogout} className="mt-6">
          <button type="submit" className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-left text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-900">
            Log out
          </button>
        </form>
      )}
    </>
  );

  /* ── MailFoundry nav content ──────────────────────────────────────── */
  const MailFoundryNav = ({ onClose }: { onClose?: () => void }) => (
    <>
      <div className="mb-10 flex items-center justify-between">
        <Link href="/dashboard" onClick={onClose}>
          <Logo height={26} variant="icon" />
        </Link>
        {onClose && (
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors lg:hidden">
            <CloseIcon />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-1 text-sm">
        <Link href="/dashboard"  onClick={onClose} className={active === "dashboard"  ? activeClass : base}>Dashboard</Link>
        <Link href="/contacts"   onClick={onClose} className={active === "contacts"   ? activeClass : base}>Contacts</Link>
        <Link href="/lists"      onClick={onClose} className={active === "lists"      ? activeClass : base}>Lists</Link>
        <Link href="/templates"  onClick={onClose} className={active === "templates"  ? activeClass : base}>Templates</Link>
        <Link href="/campaigns"  onClick={onClose} className={active === "campaigns"  ? activeClass : base}>Campaigns</Link>
        <Link href="/reports"    onClick={onClose} className={active === "reports"    ? activeClass : base}>Reports</Link>
        <Link href="/settings"   onClick={onClose} className={active === "settings"   ? activeClass : base}>Settings</Link>

        <div className="my-3 border-t border-gray-200" />

        <Link
          href="/ibsa?type=regional"
          onClick={onClose}
          className="flex items-center justify-between rounded-lg px-3 py-2.5 text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors text-sm"
        >
          <span>Xylo Ordering</span>
          <svg className="h-3.5 w-3.5 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
        <Link href="/ibsa/tools" onClick={onClose} className={base}>Tools</Link>
      </nav>

      <form action={logout} className="mt-6">
        <button type="submit" className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-left text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-900">
          Log out
        </button>
      </form>
    </>
  );

  const isIbsa = inIbsa || ibsaOnly;

  return (
    <>
      {/* ── Mobile top bar (hidden on lg+) ──────────────────────────── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4">
        <Link href={isIbsa ? "/ibsa?type=regional" : "/dashboard"}>
          <Logo height={22} variant="icon" />
        </Link>
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 transition-colors"
          aria-label="Open menu"
        >
          <HamburgerIcon />
        </button>
      </div>

      {/* ── Mobile overlay ──────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile drawer ───────────────────────────────────────────── */}
      <aside
        className={`lg:hidden fixed top-0 left-0 z-50 h-full w-72 flex flex-col overflow-y-auto border-r border-gray-200 bg-white p-6 shadow-xl transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {isIbsa
          ? <IbsaNav onClose={() => setMobileOpen(false)} />
          : <MailFoundryNav onClose={() => setMobileOpen(false)} />
        }
      </aside>

      {/* ── Desktop sidebar (hidden below lg) ───────────────────────── */}
      <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col lg:overflow-y-auto lg:border-r lg:border-gray-200 lg:bg-white lg:p-6">
        {isIbsa
          ? <IbsaNav />
          : <MailFoundryNav />
        }
      </aside>
    </>
  );
}
