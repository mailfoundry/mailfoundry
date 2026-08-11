export const metadata = { title: "Login" };

import { ibsaLogin, ibsaVerifyTotp } from "./actions";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<{ error?: string; step?: string }>;
};

export default async function IbsaLoginPage({ searchParams }: Props) {
  const { error, step } = await searchParams;

  // ── Step 2: TOTP ──────────────────────────────────────────────────────────
  if (step === "totp") {
    const jar     = await cookies();
    const pending = jar.get("_ibsa_2fa_pending")?.value;
    if (!pending) redirect("/ibsa/login");

    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-900">
        <div className="w-full max-w-sm px-6">
          <div className="mb-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-orange-500">Xylo (UK) Ltd</p>
            <h1 className="mt-2 text-2xl font-bold text-gray-900">Two-factor auth</h1>
            <p className="mt-1 text-sm text-gray-500">Enter the 6-digit code from your authenticator app.</p>
          </div>

          {error === "code" && (
            <div className="mb-6 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-600">
              Invalid code — try again.
            </div>
          )}

          <form action={ibsaVerifyTotp} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Authenticator code</label>
              <input
                type="text"
                name="code"
                autoFocus
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 text-center text-2xl tracking-widest outline-none focus:border-orange-500 placeholder:text-gray-300"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-lg bg-orange-500 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-600"
            >
              Verify
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-gray-400">
            <a href="/ibsa/login" className="hover:text-gray-700 transition-colors">← Back to password</a>
          </p>
        </div>
      </main>
    );
  }

  // ── Step 1: Password ──────────────────────────────────────────────────────
  const errorMessage =
    error === "invalid" ? "Incorrect email or password." :
    error === "missing" ? "Please enter your email and password." :
    null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-900">
      <div className="w-full max-w-sm px-6">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-orange-500">Xylo (UK) Ltd</p>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">IBSA Convention Portal</h1>
          <p className="mt-1 text-sm text-gray-500">Sign in to manage orders</p>
        </div>

        {errorMessage && (
          <div className="mb-6 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-600">
            {errorMessage}
          </div>
        )}

        <form action={ibsaLogin} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Email address</label>
            <input
              type="email"
              name="email"
              required
              autoFocus
              autoComplete="email"
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-orange-500 placeholder:text-gray-400"
              placeholder="you@xylouk.co.uk"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-orange-500 placeholder:text-gray-400"
              placeholder="Enter your password"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-orange-500 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-600"
          >
            Sign in
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-gray-400">MailFoundry · Xylo (UK) Ltd</p>
      </div>
    </main>
  );
}
