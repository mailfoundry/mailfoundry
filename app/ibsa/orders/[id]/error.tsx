"use client";

import Link from "next/link";

export default function OrderDetailError() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-8">
      <div className="text-center">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Error</p>
        <p className="mb-4 text-lg font-semibold text-gray-900">Could not load this order</p>
        <Link href="/ibsa/orders" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
          ← Back to orders
        </Link>
      </div>
    </div>
  );
}
