import Link from "next/link";
import Logo from "../../../src/components/logo";

type CheckEmailPageProps = {
  searchParams: Promise<{ email?: string }>;
};

export default async function CheckEmailPage({ searchParams }: CheckEmailPageProps) {
  const params = await searchParams;
  const email = params.email ?? "your inbox";

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-6 text-gray-900">
      <div className="w-full max-w-md text-center">
        <Link href="/" className="mb-8 inline-block">
          <Logo height={36} />
        </Link>

        <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-orange-100">
          <svg className="h-10 w-10 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21.75 9v.906a2.25 2.25 0 01-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 001.183 1.981l6.478 3.488m8.839 2.51l-4.66-2.51m0 0l-1.023-.55a2.25 2.25 0 00-2.134 0l-1.022.55m0 0l-4.661 2.51m16.5 1.615a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V8.844a2.25 2.25 0 011.183-1.981l7.5-4.04a2.25 2.25 0 012.134 0l7.5 4.04a2.25 2.25 0 011.183 1.98V19.5z" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900">Check your email</h1>
        <p className="mt-3 text-gray-500">
          We sent a sign-in link to{" "}
          <span className="font-medium text-gray-900">{email}</span>.
          Click the link in the email to access your account.
        </p>

        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500">
          The link expires in <span className="font-semibold text-gray-900">15 minutes</span> and can only be used once.
        </div>

        <p className="mt-8 text-sm text-gray-400">
          Didn&apos;t receive it?{" "}
          <Link href="/login" className="text-orange-500 hover:underline">
            Try again
          </Link>
        </p>
      </div>
    </main>
  );
}
