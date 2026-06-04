import { unsubscribeContact } from "./actions";

type UnsubscribePageProps = {
  searchParams: Promise<{
    email?: string;
    success?: string;
    error?: string;
  }>;
};

export default async function UnsubscribePage({
  searchParams,
}: UnsubscribePageProps) {
  const params = await searchParams;

  const email = params.email || "";
  const success = params.success === "1";
  const error = params.error;
  const businessName = process.env.BUSINESS_NAME || "MailFoundry";

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-white">
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-8">
        <p className="text-sm text-slate-400">{businessName}</p>

        <h1 className="mt-3 text-3xl font-bold">Unsubscribe</h1>

        {success ? (
          <div className="mt-6 rounded-xl border border-green-500/30 bg-green-500/10 p-4">
            <p className="text-sm font-semibold text-green-300">
              You have been unsubscribed.
            </p>
            <p className="mt-2 text-sm text-green-100/80">
              {email
                ? `${email} will be skipped from future marketing emails.`
                : "This contact will be skipped from future marketing emails."}
            </p>
          </div>
        ) : (
          <>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              Confirm below if you no longer want to receive marketing emails
              from {businessName}.
            </p>

            {error === "missing-email" && (
              <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                No email address was provided in the unsubscribe link.
              </div>
            )}

            {error === "not-found" && (
              <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                We could not find this email address in our mailing list.
              </div>
            )}

            {email && (
              <form action={unsubscribeContact} className="mt-6 space-y-4">
                <input type="hidden" name="email" value={email} />

                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-sm text-slate-400">Email address</p>
                  <p className="mt-1 font-semibold text-white">{email}</p>
                </div>

                <button
                  type="submit"
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
                >
                  Unsubscribe me
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </main>
  );
}
