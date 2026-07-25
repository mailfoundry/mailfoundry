type Props = { searchParams: Promise<{ name?: string }> };

export default async function OrderSubmittedPage({ searchParams }: Props) {
  const { name } = await searchParams;

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 flex items-center justify-center px-4">
      <div className="mx-auto max-w-md text-center">
        <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl text-green-600">
          ✓
        </div>
        <p className="mb-2 text-sm font-semibold text-orange-500">IBSA · Xylo (UK) Ltd</p>
        <h1 className="mb-3 text-2xl font-bold text-gray-900">Order submitted</h1>
        {name && (
          <p className="mb-4 text-gray-500">
            Thank you — we've received the order for <span className="text-gray-900 font-semibold">{name}</span>.
          </p>
        )}
        <p className="text-sm text-gray-400">
          A confirmation email has been sent. We'll be in touch shortly to confirm your order.
        </p>
      </div>
    </main>
  );
}
