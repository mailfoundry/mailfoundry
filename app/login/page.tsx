import Link from "next/link";
import { login } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    next?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const error = params.error;

  return (
    <main className="flex min-h-screen bg-slate-950 text-white">
      {/* Left panel — branding */}
      <div className="hidden flex-col justify-between p-12 lg:flex lg:w-1/2">
        <Link href="/" className="text-xl font-bold tracking-tight">
          MailFoundry
        </Link>

        <div>
          <h1 className="text-4xl font-bold leading-tight">
            Email marketing
            <br />
            <span className="text-orange-400">built to perform</span>
          </h1>
          <p className="mt-4 max-w-sm text-slate-400">
            Send campaigns, track opens, and grow your audience — all from one
            clean dashboard.
          </p>

          <ul className="mt-10 space-y-4">
            {[
              "Send campaigns to your lists in minutes",
              "Open tracking on every email you send",
              "Automatic bounce and unsubscribe handling",
            ].map((item) => (
              <li key={item} className="flex items-center gap-3 text-sm text-slate-300">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-orange-400">
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-sm text-slate-600">
          © {new Date().getFullYear()} MailFoundry
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 items-center justify-center px-6 py-12 lg:px-16">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <Link href="/" className="mb-8 block text-xl font-bold lg:hidden">
            MailFoundry
          </Link>

          <h2 className="text-2xl font-bold">Welcome back</h2>
          <p className="mt-2 text-sm text-slate-400">
            Enter your password to access your account.
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

          <form action={login} className="mt-8 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Password
              </label>
              <input
                type="password"
                name="password"
                required
                autoFocus
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
        </div>
      </div>
    </main>
  );
}
