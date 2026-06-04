import AppShell from "../../src/components/app-shell";

export default function SettingsPage() {
  const businessName = process.env.BUSINESS_NAME || "Not set";

  const fromEmail = process.env.SES_FROM_EMAIL || "Not set";

  const appBaseUrl = process.env.APP_BASE_URL || "Not set";

  const sesMode = process.env.SES_MODE || "Not set";

  const loginProtection = process.env.APP_LOGIN_PASSWORD
    ? "Enabled"
    : "Not configured";

  const authCookie = process.env.APP_AUTH_COOKIE || "mailfoundry_auth";

  const isLocalAppUrl =
    appBaseUrl.includes("localhost") || appBaseUrl.includes("127.0.0.1");

  const environmentStatus = isLocalAppUrl
    ? "Local Development"
    : "Hosted / Live URL";

  const deploymentReady =
    !isLocalAppUrl && sesMode.toLowerCase() === "production"
      ? "Review required"
      : "Not ready";

  return (
    <AppShell active="settings">
      <header className="mb-10">
        <p className="text-sm text-slate-400">System</p>
        <h2 className="text-3xl font-bold">Settings</h2>
        <p className="mt-2 text-sm text-slate-400">
          Read-only environment settings for this installation.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Business Name</p>
          <p className="mt-3 text-lg font-semibold">{businessName}</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">From Email</p>
          <p className="mt-3 text-lg font-semibold">{fromEmail}</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Base App URL</p>
          <p className="mt-3 break-all text-lg font-semibold">{appBaseUrl}</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">SES Mode</p>
          <p className="mt-3 text-lg font-semibold capitalize">{sesMode}</p>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div className="mb-4">
          <p className="text-sm text-slate-400">Environment</p>
          <h3 className="text-xl font-semibold">Deployment Status</h3>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-sm text-slate-400">Current Environment</p>
            <p className="mt-3 text-lg font-semibold text-yellow-400">
              {environmentStatus}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-sm text-slate-400">Deployment Ready</p>
            <p
              className={
                deploymentReady === "Not ready"
                  ? "mt-3 text-lg font-semibold text-red-400"
                  : "mt-3 text-lg font-semibold text-yellow-400"
              }
            >
              {deploymentReady}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-sm text-slate-400">Live Domain Target</p>
            <p className="mt-3 break-all text-lg font-semibold text-slate-300">
              app.mailfoundry.co.uk
            </p>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-slate-400">
          This installation is still considered local until the base app URL is
          moved from localhost to the hosted MailFoundry domain and production
          email safety checks are complete.
        </p>
      </div>

      <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div className="mb-4">
          <p className="text-sm text-slate-400">Security</p>
          <h3 className="text-xl font-semibold">Auth Status</h3>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-sm text-slate-400">Login Protection</p>
            <p
              className={
                loginProtection === "Enabled"
                  ? "mt-3 text-lg font-semibold text-green-400"
                  : "mt-3 text-lg font-semibold text-red-400"
              }
            >
              {loginProtection}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-sm text-slate-400">Auth Cookie</p>
            <p className="mt-3 break-all text-lg font-semibold">{authCookie}</p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-sm text-slate-400">Public Unsubscribe Route</p>
            <p className="mt-3 text-lg font-semibold text-green-400">Enabled</p>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-slate-400">
          Internal pages and API routes require login. The unsubscribe route
          remains public so recipients can opt out from email links.
        </p>
      </div>

      <div className="mt-8 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-6">
        <h3 className="text-lg font-semibold text-yellow-300">
          Production checklist reminder
        </h3>
        <p className="mt-2 text-sm leading-6 text-yellow-100/80">
          Before using a live domain or requesting AWS SES production access,
          confirm that unsubscribe links, suppression handling, archived
          contacts, unknown contact rules, and bounce/complaint handling are
          ready.
        </p>
      </div>
    </AppShell>
  );
}
