"use client";

import Link from "next/link";

export default function OrderDetailError() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-8">
      <div className="text-center">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Error</p>
        <p className="mb-4 text-lg font-semibold text-white">Could not load this order</p>
        <Link href="/ibsa/orders" className="text-sm text-slate-400 hover:text-white transition-colors">
          ← Back to orders
        </Link>
      </div>
    </div>
  );
}
