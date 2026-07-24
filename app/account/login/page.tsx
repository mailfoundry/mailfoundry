import { requestLoginLink } from "./actions";
import Logo from "../../../src/components/logo";

export const metadata = { title: "Sign in — Xylo Account" };

type Props = { searchParams: Promise<{ sent?: string; error?: string }> };

export default async function AccountLoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const sent = params.sent === "1";
  const error = params.error;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo height={36} />
        </div>

        {sent ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 9v.906a2.25 2.25 0 0 1-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 0 0 1.183 1.981l6.478 3.488m8.839 2.51-4.66-2.51m0 0-1.023-.55a2.25 2.25 0 0 0-2.134 0l-1.022.55m0 0-4.661 2.51m16.5 1.615a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V8.844a2.25 2.25 0 0 1 1.183-1.981l7.5-4.04a2.25 2.25 0 0 1 2.134 0l7.5 4.04a2.25 2.25 0 0 1 1.183 1.98V19.5Z" />
              </svg>
            </div>
            <h1 className="text-lg font-bold text-white mb-2">Check your email</h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              If that address has an account, we&apos;ve sent a login link. It&apos;s valid for 7 days.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8">
            <h1 className="text-lg font-bold text-white mb-1">Sign in to your account</h1>
            <p className="text-sm text-slate-400 mb-6">
              Enter your email and we&apos;ll send you a login link — no password needed.
            </p>

            {error === "missing-email" && (
              <div className="mb-4 rounded-lg border border-red-800 bg-red-900/30 px-4 py-3 text-sm text-red-400">
                Please enter your email address.
              </div>
            )}
            {error === "invalid-token" && (
              <div className="mb-4 rounded-lg border border-red-800 bg-red-900/30 px-4 py-3 text-sm text-red-400">
                That link has expired or already been used. Request a new one below.
              </div>
            )}

            <form action={requestLoginLink} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5">
                  Email address
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-colors"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-white hover:bg-orange-600 transition-colors"
              >
                Send login link
              </button>
            </form>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-slate-600">
          Xylo (UK) Ltd &nbsp;·&nbsp;{" "}
          <a href="https://www.xylouk.co.uk" className="hover:text-slate-400 transition-colors">
            xylouk.co.uk
          </a>
        </p>
      </div>
    </div>
  );
}
