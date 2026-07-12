import { requestConventionLink } from "./actions";

type Props = { searchParams: Promise<{ error?: string }> };

const errors: Record<string, string> = {
  "missing-email":  "Please enter your email address.",
  "not-found":      "We couldn't find a convention linked to that email address. Check with your IBSA contact.",
  "invalid-token":  "That link has expired or already been used. Request a new one below.",
};

export default async function ConventionLoginPage({ searchParams }: Props) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-sm">
        {/* Logo / brand */}
        <div className="mb-8 text-center">
          <p className="text-lg font-bold text-orange-500">IBSA · Xylo Supplies</p>
          <h1 className="mt-1 text-2xl font-bold text-white">Convention Order Form</h1>
          <p className="mt-2 text-sm text-slate-400">Enter your email to receive a secure sign-in link.</p>
        </div>

        {/* Error */}
        {error && errors[error] && (
          <div className="mb-4 rounded-xl border border-red-800/50 bg-red-950/30 px-4 py-3 text-sm text-red-400">
            {errors[error]}
          </div>
        )}

        {/* Form */}
        <form action={requestConventionLink} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-400">Email address</label>
            <input
              type="email"
              name="email"
              required
              autoFocus
              placeholder="you@example.com"
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-orange-500 placeholder:text-slate-600"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-xl bg-orange-500 py-3 text-sm font-bold text-white hover:bg-orange-400"
          >
            Send me a sign-in link
          </button>
        </form>
      </div>
    </main>
  );
}
