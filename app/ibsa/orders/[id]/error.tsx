"use client";

export default function OrderDetailError({ error }: { error: Error & { digest?: string } }) {
  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-xl rounded-2xl border border-red-900/40 bg-red-950/20 p-6">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-red-600">Server error — order detail</p>
        <p className="mb-4 text-sm font-semibold text-red-300">{error.message}</p>
        {error.digest && (
          <p className="text-xs text-slate-600">Digest: {error.digest}</p>
        )}
        <p className="mt-4 text-xs text-slate-500">
          Check Vercel function logs for the full stack trace.
        </p>
      </div>
    </div>
  );
}
