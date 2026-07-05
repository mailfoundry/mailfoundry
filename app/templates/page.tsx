import Link from "next/link";
import { prisma } from "../../src/lib/prisma";
import AppShell from "../../src/components/app-shell";

export default async function TemplatesPage() {
  const templates = await prisma.template.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { campaigns: true } } },
  });

  return (
    <AppShell active="templates">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">Content</p>
          <h2 className="text-3xl font-bold">Templates</h2>
        </div>
        <Link
          href="/templates/new"
          className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900"
        >
          New Template
        </Link>
      </header>

      {templates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-8">
          <h3 className="text-xl font-semibold">No templates yet</h3>
          <p className="mt-3 max-w-2xl text-slate-400">
            Save reusable email designs as templates so you can spin up campaigns faster.
          </p>
          <Link
            href="/templates/new"
            className="mt-6 inline-block rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
          >
            Create your first template
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-800 bg-slate-950/50 text-left text-slate-400">
              <tr>
                <th className="px-6 py-4 font-medium">Name</th>
                <th className="px-6 py-4 font-medium">Subject</th>
                <th className="px-6 py-4 font-medium">Used in</th>
                <th className="px-6 py-4 font-medium">Created</th>
                <th className="px-6 py-4 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr key={template.id} className="border-t border-slate-800">
                  <td className="px-6 py-4 font-medium">
                    <Link href={`/templates/${template.id}`} className="hover:underline">
                      {template.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-slate-300">{template.subject}</td>
                  <td className="px-6 py-4 text-slate-400">
                    {template._count.campaigns}{" "}
                    {template._count.campaigns === 1 ? "campaign" : "campaigns"}
                  </td>
                  <td className="px-6 py-4 text-slate-400">
                    {new Date(template.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/templates/${template.id}`}
                      className="text-sm text-orange-400 hover:underline"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
