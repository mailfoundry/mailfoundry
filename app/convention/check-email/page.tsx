type Props = { searchParams: Promise<{ email?: string }> };

export default async function ConventionCheckEmailPage({ searchParams }: Props) {
  const { email } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-sm text-center">
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-500/20">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8 text-orange-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
        </div>

        <p className="text-lg font-bold text-orange-500">IBSA · Xylo (UK) Ltd</p>
        <h1 className="mt-2 text-2xl font-bold text-white">Check your email</h1>
        <p className="mt-3 text-sm text-slate-400">
          We've sent a sign-in link to{" "}
          <span className="font-medium text-white">{email ?? "your email address"}</span>.
        </p>
        <p className="mt-2 text-sm text-slate-500">The link expires in 1 hour.</p>

        <a
          href="/convention"
          className="mt-8 inline-block text-sm text-slate-500 hover:text-slate-300"
        >
          ← Try a different email
        </a>
      </div>
    </main>
  );
}
