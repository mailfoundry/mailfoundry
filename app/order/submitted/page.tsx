import Link from "next/link";
import Logo from "../../../src/components/logo";

type Props = { searchParams: Promise<{ name?: string }> };

export default async function OrderSubmittedPage({ searchParams }: Props) {
  const { name } = await searchParams;
  const groupName = name ? decodeURIComponent(name) : "your group";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <Logo height={32} />
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-8 text-center">
          {/* Tick */}
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
            <svg className="h-7 w-7 text-green-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>

          <h1 className="text-xl font-bold text-gray-900 mb-2">Order received</h1>
          <p className="text-sm text-gray-500 mb-6">
            Thank you — we&apos;ve received your order for{" "}
            <strong className="text-gray-700">{groupName}</strong> and will be in touch to confirm delivery details.
          </p>

          {/* What happens next */}
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 text-left mb-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">What happens next</p>
            <ol className="space-y-2.5">
              {[
                "Check your email — a confirmation with your full order details is on its way.",
                "We'll review your order and be in touch to confirm delivery and any questions.",
                "Your account link is in the email — use it to track your order status and re-order in future.",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-600 mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-sm text-gray-600">{step}</p>
                </li>
              ))}
            </ol>
          </div>

          <Link
            href="/order"
            className="inline-block rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Place another order
          </Link>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          Questions? Email{" "}
          <a href="mailto:ibsa@xylouk.co.uk" className="text-orange-500 hover:underline">
            ibsa@xylouk.co.uk
          </a>
        </p>
      </div>
    </div>
  );
}
