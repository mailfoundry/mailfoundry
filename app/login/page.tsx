import { login } from "./actions";
import Logo from "../../src/components/logo";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const error = params.error;

  const errorMessage =
    error === "invalid"
      ? "Incorrect password. Please try again."
      : error === "missing-email"
        ? "Please enter your email address."
        : error === "missing-config"
          ? "Login is not configured correctly."
          : error === "invalid-token"
            ? "This sign-in link has expired or already been used. Please try again."
            : error === "restricted"
              ? "Access to this account is restricted."
              : null;

  return (
    <main className="flex min-h-screen bg-slate-950 text-white">
      {/* Left panel — branding */}
      <div className="hidden flex-col justify-between p-12 lg:flex lg:w-1/2">
        <div>
          <Logo height={44} />
        </div>

        <div>
          <h1 className="text-4xl font-bold leading-tight">
            Convention &amp; congregation
            <br />
            <span className="text-orange-400">supply ordering</span>
          </h1>
          <p className="mt-4 max-w-sm text-slate-400">
            Order cleaning supplies and first aid products for your regional convention,
            circuit assembly, or congregation — all from one place.
          </p>

          <ul className="mt-10 space-y-4">
            {[
              "Cleaning supplies, first aid and safety equipment",
              "Order for regional conventions, circuits and congregations",
              "Fast fulfilment direct from Xylo (UK) Ltd",
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
          © {new Date().getFullYear()} Xylo (UK) Ltd · <a href="https://www.xylouk.co.uk" className="hover:text-slate-400 transition-colors">xylouk.co.uk</a>
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 items-center justify-center px-6 py-12 lg:px-16">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="mb-8 block lg:hidden">
            <Logo height={34} />
          </div>

          <h2 className="text-2xl font-bold">Staff sign in</h2>
          <p className="mt-2 text-sm text-slate-400">
            Enter your email and password to access the ordering portal.
          </p>

          {errorMessage && (
            <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              {errorMessage}
            </div>
          )}

          <form action={login} className="mt-8 space-y-4">
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
                placeholder="you@example.com"
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
              Send sign-in link
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
