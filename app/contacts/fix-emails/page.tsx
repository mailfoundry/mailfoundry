export const metadata = { title: "Fix email typos" };

import Link from "next/link";
import AppShell from "../../../src/components/app-shell";
import { prisma } from "../../../src/lib/prisma";
import { checkEmail, type EmailIssue } from "./logic";
import { applyEmailFixes } from "./actions";

export const dynamic = "force-dynamic";

export default async function FixEmailsPage({
  searchParams,
}: {
  searchParams: Promise<{ fixed?: string; archived?: string }>;
}) {
  const sp = await searchParams;

  const contacts = await prisma.contact.findMany({
    where: { archivedAt: null },
    select: { id: true, email: true, firstName: true, lastName: true, bouncedAt: true },
  });
  const existing = new Set((await prisma.contact.findMany({ select: { email: true } })).map((c) => c.email.toLowerCase()));

  type Row = (typeof contacts)[number] & { issue: EmailIssue; action: "fix" | "archive"; note: string };
  const rows: Row[] = [];
  for (const c of contacts) {
    const issue = checkEmail(c.email);
    if (!issue) continue;
    if (issue.kind === "fix") {
      const dup = existing.has(issue.suggested);
      rows.push({ ...c, issue, action: dup ? "archive" : "fix", note: dup ? "corrected address already on file — archive duplicate" : issue.reason });
    } else {
      rows.push({ ...c, issue, action: "archive", note: issue.reason });
    }
  }
  const fixes = rows.filter((r) => r.action === "fix").length;
  const archives = rows.length - fixes;

  return (
    <AppShell active="contacts">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Audience</p>
          <h2 className="text-3xl font-bold">Fix email typos</h2>
          <p className="mt-1 text-sm text-gray-500">
            Finds mistyped providers and endings (e.g. <code>icloud.con</code>, <code>otmail.com</code>, <code>live.co.ik</code>)
            before they bounce and hurt your sending reputation. Business domains are left alone.
          </p>
        </div>
        <Link href="/contacts" className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100">
          Back to Contacts
        </Link>
      </header>

      {(sp.fixed || sp.archived) && (
        <p className="mb-6 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          Done — {Number(sp.fixed ?? 0).toLocaleString()} addresses corrected, {Number(sp.archived ?? 0).toLocaleString()} archived.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
          <p className="text-sm text-gray-500">Active contacts checked</p>
          <p className="mt-2 text-2xl font-bold">{contacts.length.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
          <p className="text-sm text-gray-500">Will be corrected</p>
          <p className="mt-2 text-2xl font-bold text-green-600">{fixes.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
          <p className="text-sm text-gray-500">Will be archived</p>
          <p className="mt-2 text-2xl font-bold text-orange-500">{archives.toLocaleString()}</p>
        </div>
      </div>

      {rows.length > 0 ? (
        <>
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold uppercase text-gray-400">Current</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase text-gray-400">Action</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase text-gray-400">Becomes</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase text-gray-400">Why</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.slice(0, 300).map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2 font-mono text-xs text-gray-600">{r.email}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.action === "fix" ? "bg-green-500/10 text-green-600" : "bg-orange-500/10 text-orange-500"}`}>
                        {r.action === "fix" ? "Correct" : "Archive"}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs font-semibold text-gray-900">
                      {r.issue.kind === "fix" && r.action === "fix" ? r.issue.suggested : "—"}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 300 && <p className="mt-2 text-xs text-gray-400">Showing first 300 of {rows.length.toLocaleString()}.</p>}

          <form action={applyEmailFixes} className="mt-6">
            <button type="submit" className="rounded-lg bg-orange-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-orange-600">
              Apply: correct {fixes.toLocaleString()}, archive {archives.toLocaleString()}
            </button>
          </form>
        </>
      ) : (
        <p className="rounded-2xl border border-dashed border-gray-200 p-10 text-center text-sm text-gray-400">
          No typos found — your list looks clean.
        </p>
      )}
    </AppShell>
  );
}
