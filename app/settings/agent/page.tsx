export const metadata = { title: "ChatGPT agent access" };
export const dynamic = "force-dynamic";

import AppShell from "../../../src/components/app-shell";
import { prisma } from "../../../src/lib/prisma";
import CreateToken from "./CreateToken";
import { revokeAgentToken } from "./actions";

const fmt = (d: Date | null) => (d ? d.toLocaleString("en-GB", { timeZone: "Europe/London" }) : "—");

export default async function AgentAccessPage() {
  const [tokens, log] = await Promise.all([
    prisma.agentToken.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.auditLog.findMany({ where: { actor: { startsWith: "agent:" } }, orderBy: { at: "desc" }, take: 40 }),
  ]);
  const base = process.env.APP_BASE_URL ?? "https://ibsa.xylouk.co.uk";

  return (
    <AppShell active="settings">
      <header className="mb-8">
        <p className="text-sm text-gray-500">Settings</p>
        <h2 className="text-3xl font-bold">ChatGPT agent access</h2>
        <p className="mt-2 max-w-3xl text-sm text-gray-500">
          The agent API lets ChatGPT draft, test, schedule (after your final approval) and report on SCS/SWF campaigns. It can&apos;t approve,
          send immediately, change brand rules or touch suppression. Schema for the custom GPT Action:{" "}
          <code className="rounded bg-gray-100 px-1">{base}/api/agent/v1/openapi.json</code>
        </p>
      </header>

      <section className="mb-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-3 text-lg font-semibold">Create a token</h3>
        <CreateToken />
      </section>

      <section className="mb-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-3 text-lg font-semibold">Tokens</h3>
        {tokens.length === 0 ? (
          <p className="text-sm text-gray-500">None yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-gray-500">
              <tr><th className="py-1">Name</th><th>Starts</th><th>Created</th><th>Last used</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {tokens.map((t) => (
                <tr key={t.id} className="border-t border-gray-100">
                  <td className="py-2 font-medium">{t.name}</td>
                  <td className="font-mono text-xs">{t.prefix}…</td>
                  <td>{fmt(t.createdAt)}</td>
                  <td>{fmt(t.lastUsedAt)}</td>
                  <td>{t.revokedAt ? <span className="text-red-600">revoked</span> : <span className="text-green-700">active</span>}</td>
                  <td className="text-right">
                    {!t.revokedAt && (
                      <form action={revokeAgentToken.bind(null, t.id)}>
                        <button className="rounded-lg border border-red-300 px-3 py-1 text-xs font-semibold text-red-700">Revoke</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-3 text-lg font-semibold">Recent agent activity</h3>
        <ul className="space-y-1 text-xs text-gray-700">
          {log.map((l) => (
            <li key={l.id}>
              {fmt(l.at)} · <strong>{l.action}</strong> · {l.actor}
              {l.campaignId ? <> · <a className="underline" href={`/campaigns/${l.campaignId}`}>campaign</a></> : null}
            </li>
          ))}
          {log.length === 0 && <li className="text-gray-400">No activity yet.</li>}
        </ul>
      </section>
    </AppShell>
  );
}
