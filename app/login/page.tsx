import { login } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const error = params.error;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8">
        <p className="text-sm text-slate-400">Internal Build V1</p>
        <h1 className="mt-3 text-3xl font-bold">Sign in to MailFoundry</h1>
        <p className="mt-2 text-sm text-slate-400">
          Enter the internal password to access MailFoundry.
        </p>

        {error === "invalid" && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            Incorrect password. Try again.
          </div>
        )}

        {error === "missing-config" && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            Login password is not configured.
          </div>
        )}

        <form action={login} className="mt-6 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Password
            </label>
            <input
              type="password"
              name="password"
              required
              autoFocus
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none"
              placeholder="Enter password"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-400"
          >
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
