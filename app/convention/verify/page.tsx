import { verifyConventionToken } from "../actions";

type Props = { searchParams: Promise<{ token?: string }> };

export default async function ConventionVerifyPage({ searchParams }: Props) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <p className="text-orange-500 font-bold text-lg">IBSA · Xylo (UK) Ltd</p>
          <p className="mt-4 text-gray-900 text-xl font-bold">Invalid link</p>
          <a href="/convention" className="mt-4 inline-block text-sm text-orange-400 hover:underline">
            Request a new sign-in link →
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm text-center">
        <p className="text-orange-500 font-bold text-lg">IBSA · Xylo (UK) Ltd</p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Opening your order form…</h1>
        <p className="mt-2 text-sm text-gray-500">Click the button below if you aren't redirected automatically.</p>

        <form action={verifyConventionToken} className="mt-6">
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            className="w-full rounded-xl bg-orange-500 py-3 text-sm font-bold text-gray-900 hover:bg-orange-400"
          >
            Open my order form
          </button>
        </form>

        <a href="/convention" className="mt-6 inline-block text-sm text-gray-400 hover:text-gray-600">
          ← Request a new link
        </a>
      </div>
    </main>
  );
}
