import Link from "next/link";
import Logo from "../../../src/components/logo";
import { prisma } from "../../../src/lib/prisma";
import { confirmVerify } from "../actions";

type VerifyPageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function VerifyPage({ searchParams }: VerifyPageProps) {
  const params = await searchParams;
  const token = params.token ?? "";

  // Check validity WITHOUT consuming the token
  // (email scanners make GET requests — we must not mark as used here)
  const loginToken = token
    ? await prisma.loginToken.findUnique({ where: { token } })
    : null;

  const isValid =
    loginToken && !loginToken.usedAt && loginToken.expiresAt > new Date();

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
      <div className="w-full max-w-md text-center">
        <Link href="/" className="mb-8 inline-block">
          <Logo height={36} />
        </Link>

        {isValid ? (
          <>
            <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-orange-500/10">
              <svg className="h-10 w-10 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>

            <h1 className="text-2xl font-bold">Confirm sign in</h1>
            <p className="mt-3 text-slate-400">
              Signing in as{" "}
              <span className="font-medium text-white">{loginToken.email}</span>.
              Click the button below to access your account.
            </p>

            <form action={confirmVerify} className="mt-8">
              <input type="hidden" name="token" value={token} />
              <button
                type="submit"
                className="w-full rounded-xl bg-orange-500 px-8 py-3.5 text-sm font-semibold text-white hover:bg-orange-600"
              >
                Sign in to MailFoundry
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10">
              <svg className="h-10 w-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>

            <h1 className="text-2xl font-bold">Link expired</h1>
            <p className="mt-3 text-slate-400">
              This sign-in link has expired or already been used.
            </p>
            <Link
              href="/login"
              className="mt-8 inline-block rounded-xl bg-orange-500 px-8 py-3.5 text-sm font-semibold text-white hover:bg-orange-600"
            >
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
