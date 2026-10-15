export const metadata = { title: "Clean contact names" };

import Link from "next/link";
import AppShell from "../../../src/components/app-shell";
import { prisma } from "../../../src/lib/prisma";
import { proposeNameChange, type NameChange } from "./logic";
import { applyNameCleanup } from "./actions";

export const dynamic = "force-dynamic";

const show = (v: string | null) => (v && v.trim() ? v : <span className="text-gray-300">—</span>);

export default async function CleanNamesPage({ searchParams }: { searchParams: Promise<{ applied?: string }> }) {
  const { applied } = await searchParams;

  const rows = await prisma.contact.findMany({ select: { id: true, email: true, firstName: true, lastName: true } });
  const changes = rows.map(proposeNameChange).filter((c): c is NameChange => !!c);

  const byReason = new Map<string, number>();
  for (const c of changes) for (const r of c.reasons) byReason.set(r, (byReason.get(r) ?? 0) + 1);

  const changeById = new Map(changes.map((c) => [c.id, c]));
  const noFirstAfter = rows.filter((r) => {
    const c = changeById.get(r.id);
    return !(c ? c.newFirst : r.firstName && r.firstName.trim());
  }).length;

  // Show a mixed sample: some of each kind of change
  const sample: NameChange[] = [];
  for (const reason of byReason.keys()) sample.push(...changes.filter((c) => c.reasons.includes(reason)).slice(0, 15));
  const uniqueSample = [...new Map(sample.map((c) => [c.id, c])).values()].slice(0, 80);

  return (
    <AppShell active="contacts">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Audience</p>
          <h2 className="text-3xl font-bold">Clean contact names</h2>
          <p className="mt-1 text-sm text-gray-500">
            Tidies capitalisation, removes junk names, and splits full names typed into the first-name field.
            Review the sample below before applying.
          </p>
        </div>
        <Link href="/contacts" className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100">
          Back to Contacts
        </Link>
      </header>

      {applied && (
        <p className="mb-6 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          Done — {Number(applied).toLocaleString()} contacts updated.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-4 mb-6">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
          <p className="text-sm text-gray-500">Contacts</p>
          <p className="mt-2 text-2xl font-bold">{rows.length.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
          <p className="text-sm text-gray-500">Will change</p>
          <p className="mt-2 text-2xl font-bold text-orange-500">{changes.length.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5 sm:col-span-2">
          <p className="text-sm text-gray-500">No first name afterwards (will see the fallback, e.g. &ldquo;Hi there&rdquo;)</p>
          <p className="mt-2 text-2xl font-bold text-gray-700">{noFirstAfter.toLocaleString()}</p>
        </div>
      </div>

      {byReason.size > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {[...byReason.entries()].map(([r, n]) => (
            <span key={r} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
              {r}: {n.toLocaleString()}
            </span>
          ))}
        </div>
      )}

      {changes.length > 0 ? (
        <>
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold uppercase text-gray-400">Email</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase text-gray-400">Before</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase text-gray-400">After</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase text-gray-400">Why</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {uniqueSample.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-2 font-mono text-xs text-gray-600">{c.email}</td>
                    <td className="px-4 py-2 text-gray-500">{show(c.firstName)} / {show(c.lastName)}</td>
                    <td className="px-4 py-2 font-semibold text-gray-900">{show(c.newFirst)} / {show(c.newLast)}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{c.reasons.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-gray-400">Showing a sample of up to 80 changes across each type.</p>

          <form action={applyNameCleanup} className="mt-6">
            <button type="submit" className="rounded-lg bg-orange-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-orange-600">
              Apply to {changes.length.toLocaleString()} contacts
            </button>
          </form>
        </>
      ) : (
        <p className="rounded-2xl border border-dashed border-gray-200 p-10 text-center text-sm text-gray-400">
          Nothing to clean — all names look tidy.
        </p>
      )}
    </AppShell>
  );
}
