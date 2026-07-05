import Link from "next/link";
import { prisma } from "../../src/lib/prisma";
import AppShell from "../../src/components/app-shell";
import { Prisma } from "../../src/generated/prisma/client";

type ContactsPageProps = {
  searchParams: Promise<{ filter?: string; q?: string; list?: string }>;
};

function getSubscriptionStatus(contact: {
  subscribedAt: Date | null;
  unsubscribedAt: Date | null;
  archivedAt: Date | null;
  bouncedAt: Date | null;
  complainedAt: Date | null;
}) {
  if (contact.unsubscribedAt) return { label: "Unsubscribed", className: "bg-red-500/10 text-red-400" };
  if (contact.archivedAt) return { label: "Archived", className: "bg-slate-500/10 text-slate-300" };
  if (contact.bouncedAt) return { label: "Bounced", className: "bg-orange-500/10 text-orange-400" };
  if (contact.complainedAt) return { label: "Complained", className: "bg-red-500/10 text-red-400" };
  if (contact.subscribedAt) return { label: "Subscribed", className: "bg-green-500/10 text-green-400" };
  return { label: "Unknown", className: "bg-slate-500/10 text-slate-400" };
}

function buildWhere(filter: string, q: string, listId: string): Prisma.ContactWhereInput {
  const search: Prisma.ContactWhereInput = q
    ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }] }
    : {};
  const listFilter: Prisma.ContactWhereInput = listId ? { lists: { some: { listId } } } : {};
  const statusFilter: Prisma.ContactWhereInput =
    filter === "subscribed" ? { subscribedAt: { not: null }, unsubscribedAt: null, archivedAt: null, bouncedAt: null, complainedAt: null }
    : filter === "unsubscribed" ? { unsubscribedAt: { not: null } }
    : filter === "bounced" ? { bouncedAt: { not: null } }
    : filter === "complained" ? { complainedAt: { not: null } }
    : filter === "archived" ? { archivedAt: { not: null } }
    : filter === "unknown" ? { subscribedAt: null, unsubscribedAt: null, archivedAt: null, bouncedAt: null, complainedAt: null }
    : filter === "all" ? {}
    : { archivedAt: null, unsubscribedAt: null, bouncedAt: null, complainedAt: null, subscribedAt: { not: null } };
  return { AND: [statusFilter, listFilter, search] };
}

const FILTERS = [
  { key: "active", label: "Active" },
  { key: "subscribed", label: "Subscribed" },
  { key: "unsubscribed", label: "Unsubscribed" },
  { key: "bounced", label: "Bounced" },
  { key: "complained", label: "Complained" },
  { key: "archived", label: "Archived" },
  { key: "unknown", label: "Unknown" },
  { key: "all", label: "All" },
];

export default async function ContactsPage({ searchParams }: ContactsPageProps) {
  const params = await searchParams;
  const filter = params.filter || "active";
  const q = params.q || "";
  const listId = params.list || "";

  const [contacts, lists, counts] = await Promise.all([
    prisma.contact.findMany({ where: buildWhere(filter, q, listId), orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.list.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    Promise.all([
      prisma.contact.count({ where: { subscribedAt: { not: null }, unsubscribedAt: null, archivedAt: null, bouncedAt: null, complainedAt: null } }),
      prisma.contact.count({ where: { unsubscribedAt: { not: null } } }),
      prisma.contact.count({ where: { bouncedAt: { not: null } } }),
      prisma.contact.count({ where: { complainedAt: { not: null } } }),
      prisma.contact.count({ where: { archivedAt: { not: null } } }),
      prisma.contact.count({ where: { subscribedAt: null, unsubscribedAt: null, archivedAt: null, bouncedAt: null, complainedAt: null } }),
      prisma.contact.count(),
    ]),
  ]);

  const [subscribedCount, unsubscribedCount, bouncedCount, complainedCount, archivedCount, unknownCount, totalCount] = counts;

  const statCards = [
    { label: "Subscribed", count: subscribedCount, filter: "subscribed", color: "text-green-400" },
    { label: "Unsubscribed", count: unsubscribedCount, filter: "unsubscribed", color: "text-red-400" },
    { label: "Bounced", count: bouncedCount, filter: "bounced", color: "text-orange-400" },
    { label: "Complained", count: complainedCount, filter: "complained", color: "text-red-400" },
    { label: "Archived", count: archivedCount, filter: "archived", color: "text-slate-300" },
    { label: "Unknown", count: unknownCount, filter: "unknown", color: "text-slate-400" },
    { label: "Total", count: totalCount, filter: "all", color: "text-white" },
  ];

  function filterUrl(f: string) {
    const p = new URLSearchParams();
    p.set("filter", f);
    if (q) p.set("q", q);
    if (listId) p.set("list", listId);
    return `/contacts?${p.toString()}`;
  }

  return (
    <AppShell active="contacts">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">Audience</p>
          <h2 className="text-3xl font-bold">Contacts</h2>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/contacts/import" className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800">Import CSV</Link>
          <Link href="/contacts/new" className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900">Add Contact</Link>
        </div>
      </header>

      <div className="mb-6 grid gap-3 grid-cols-4 xl:grid-cols-7">
        {statCards.map((s) => (
          <Link key={s.filter} href={filterUrl(s.filter)}
            className={`rounded-2xl border p-4 transition-colors ${filter === s.filter ? "border-orange-500/50 bg-orange-500/10" : "border-slate-800 bg-slate-900 hover:border-slate-700"}`}>
            <p className="text-xs text-slate-400">{s.label}</p>
            <p className={`mt-1 text-2xl font-bold ${s.color}`}>{s.count}</p>
          </Link>
        ))}
      </div>

      <form method="GET" action="/contacts" className="mb-6 flex gap-3">
        <input type="hidden" name="filter" value={filter} />
        <input type="search" name="q" defaultValue={q} placeholder="Search by email or name..."
          className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-white outline-none focus:border-orange-500" />
        <select name="list" defaultValue={listId}
          className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-white outline-none focus:border-orange-500">
          <option value="">All lists</option>
          {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <button type="submit" className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600">Search</button>
        {(q || listId) && (
          <Link href={filterUrl(filter)} className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-400 hover:bg-slate-800">Clear</Link>
        )}
      </form>

      <div className="mb-6 flex flex-wrap gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1 text-sm w-fit">
        {FILTERS.map((f) => (
          <Link key={f.key} href={filterUrl(f.key)}
            className={filter === f.key ? "rounded-md bg-slate-800 px-3 py-1.5 text-white" : "px-3 py-1.5 text-slate-400 hover:text-white"}>
            {f.label}
          </Link>
        ))}
      </div>

      {contacts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-8">
          <h3 className="text-xl font-semibold">No contacts found</h3>
          <p className="mt-3 text-slate-400">Try a different filter or search term.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <div className="border-b border-slate-800 px-6 py-3 text-xs text-slate-500">
            Showing {contacts.length} contact{contacts.length !== 1 ? "s" : ""}{q && ` matching "${q}"`}
          </div>
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-800 bg-slate-950/50 text-left text-slate-400">
              <tr>
                <th className="px-6 py-4 font-medium">Email</th>
                <th className="px-6 py-4 font-medium">Name</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Source</th>
                <th className="px-6 py-4 font-medium">Added</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => {
                const status = getSubscriptionStatus(contact);
                return (
                  <tr key={contact.id} className="border-t border-slate-800 hover:bg-slate-950/30">
                    <td className="px-6 py-4"><Link href={`/contacts/${contact.id}`} className="hover:underline">{contact.email}</Link></td>
                    <td className="px-6 py-4 text-slate-300">{[contact.firstName, contact.lastName].filter(Boolean).join(" ") || "—"}</td>
                    <td className="px-6 py-4"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${status.className}`}>{status.label}</span></td>
                    <td className="px-6 py-4 text-slate-400">{contact.source || "—"}</td>
                    <td className="px-6 py-4 text-slate-400">{new Date(contact.createdAt).toLocaleDateString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
