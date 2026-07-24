type Props = { searchParams: Promise<{ name?: string }> };

export default async function OrderSubmittedPage({ searchParams }: Props) {
  const { name } = await searchParams;

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
      <div className="mx-auto max-w-md text-center">
        <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-900/40 text-3xl">
          ✓
        </div>
        <p className="mb-2 text-sm font-semibold text-orange-500">IBSA · Xylo (UK) Ltd</p>
        <h1 className="mb-3 text-2xl font-bold text-white">Order submitted</h1>
        {name && (
          <p className="mb-4 text-slate-400">
            Thank you — we've received the order for <span className="text-white font-semibold">{name}</span>.
          </p>
        )}
        <p className="text-sm text-slate-500">
          A confirmation email has been sent. We'll be in touch shortly to confirm your order.
        </p>
      </div>
    </main>
  );
}
