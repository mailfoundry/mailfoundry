import Link from "next/link";

export default function MarketingPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-6">
        <span className="text-xl font-bold tracking-tight">MailFoundry</span>
        <Link
          href="/login"
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
        >
          Sign in
        </Link>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-8 pb-24 pt-20 text-center">
        <div className="mb-6 inline-block rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-1.5 text-sm font-medium text-orange-400">
          Email marketing, simplified
        </div>

        <h1 className="text-5xl font-bold leading-tight tracking-tight sm:text-6xl">
          Send campaigns that
          <br />
          <span className="text-orange-400">actually get read</span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
          MailFoundry gives you everything you need to build your audience,
          send beautiful campaigns, and track what's working — without the
          complexity of bloated marketing platforms.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/login"
            className="rounded-xl bg-orange-500 px-8 py-3.5 text-sm font-semibold text-white hover:bg-orange-600"
          >
            Sign in to MailFoundry
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-slate-800 bg-slate-900/50">
        <div className="mx-auto max-w-5xl px-8 py-20">
          <h2 className="mb-12 text-center text-2xl font-bold">
            Everything you need, nothing you don&apos;t
          </h2>

          <div className="grid gap-8 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10">
                <svg className="h-5 w-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-semibold">Send with confidence</h3>
              <p className="text-sm text-slate-400">
                Build and preview campaigns before sending. Bounces and
                complaints are automatically suppressed so your sender
                reputation stays clean.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10">
                <svg className="h-5 w-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-semibold">Know who&apos;s reading</h3>
              <p className="text-sm text-slate-400">
                Open tracking built in. See exactly who opened your campaign
                and when, with overall open rates on every campaign.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10">
                <svg className="h-5 w-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-semibold">Your audience, under control</h3>
              <p className="text-sm text-slate-400">
                Import contacts via CSV, organise them into lists, and let
                MailFoundry handle unsubscribes automatically so you stay
                compliant.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-3xl px-8 py-20 text-center">
        <h2 className="text-3xl font-bold">Ready to get started?</h2>
        <p className="mt-4 text-slate-400">
          Sign in to your MailFoundry account and send your next campaign.
        </p>
        <Link
          href="/login"
          className="mt-8 inline-block rounded-xl bg-orange-500 px-8 py-3.5 text-sm font-semibold text-white hover:bg-orange-600"
        >
          Sign in to MailFoundry
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 px-8 py-8 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} MailFoundry. All rights reserved.
      </footer>
    </main>
  );
}
