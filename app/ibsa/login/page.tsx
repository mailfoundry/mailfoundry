import { ibsaLogin } from "./actions";

type Props = {
  searchParams: Promise<{ error?: string }>;
};

export default async function IbsaLoginPage({ searchParams }: Props) {
  const { error } = await searchParams;

  const errorMessage =
    error === "invalid"
      ? "Incorrect email or password."
      : error === "missing"
      ? "Please enter your email and password."
      : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
      <div className="w-full max-w-sm px-6">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-orange-500">
            Xylo (UK) Ltd
          </p>
          <h1 className="mt-2 text-2xl font-bold">IBSA Convention Portal</h1>
          <p className="mt-1 text-sm text-slate-400">Sign in to manage orders</p>
        </div>

        {errorMessage && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {errorMessage}
          </div>
        )}

        <form action={ibsaLogin} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Email address
            </label>
            <input
              type="email"
              name="email"
              required
              autoFocus
              autoComplete="email"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-orange-500"
              placeholder="you@xylouk.co.uk"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Password
            </label>
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-orange-500"
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

        <p className="mt-8 text-center text-xs text-slate-700">
          MailFoundry · Xylo (UK) Ltd
        </p>
      </div>
    </main>
  );
}
