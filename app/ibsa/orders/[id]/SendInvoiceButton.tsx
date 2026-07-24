"use client";

import { useTransition, useState } from "react";
import { sendStripeInvoice } from "./actions";

type Props = {
  orderId: string;
  stripeInvoiceId: string | null;
  invoicedAt: Date | null;
};

export default function SendInvoiceButton({ orderId, stripeInvoiceId, invoicedAt }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  if (stripeInvoiceId) {
    return (
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-900/30 px-3 py-1 text-xs font-semibold text-green-400">
          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
          </svg>
          Invoice sent
        </span>
        {invoicedAt && (
          <span className="text-xs text-slate-500">
            {invoicedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </span>
        )}
        <a
          href={`https://dashboard.stripe.com/invoices/${stripeInvoiceId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          View in Stripe →
        </a>
      </div>
    );
  }

  if (!confirmed) {
    return (
      <div>
        <button
          onClick={() => setConfirmed(true)}
          className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-600 transition-colors"
        >
          Send invoice via Stripe
        </button>
        <p className="mt-2 text-xs text-slate-500">
          Stripe will email the invoice directly to {"{email}"} with a Pay Online link.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-300">
        This will create and send a Stripe invoice. The customer will receive an email with a payment link. This cannot be undone.
      </p>
      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
      <div className="flex items-center gap-3">
        <button
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              try {
                await sendStripeInvoice(orderId);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Something went wrong");
              }
            });
          }}
          className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {pending ? "Sending…" : "Confirm — send invoice"}
        </button>
        <button
          onClick={() => setConfirmed(false)}
          className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
