import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "../../../src/components/app-shell";
import SubmitButton from "../../../src/components/submit-button";
import { prisma } from "../../../src/lib/prisma";
import { updateTemplate, deleteTemplate } from "./actions";

type Props = { params: Promise<{ id: string }> };

export default async function EditTemplatePage({ params }: Props) {
  const { id } = await params;
  const template = await prisma.template.findUnique({
    where: { id },
    include: { _count: { select: { campaigns: true } } },
  });

  if (!template) notFound();

  return (
    <AppShell active="templates">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">Content</p>
          <h2 className="text-3xl font-bold">Edit Template</h2>
        </div>
        <Link
          href="/templates"
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
        >
          Back to Templates
        </Link>
      </header>

      {template._count.campaigns > 0 && (
        <div className="mb-6 rounded-xl border border-sky-500/30 bg-sky-500/10 p-4 text-sm text-sky-300">
          This template is used in {template._count.campaigns}{" "}
          {template._count.campaigns === 1 ? "campaign" : "campaigns"}.
          Changes here won&apos;t affect campaigns already sent.
        </div>
      )}

      <div className="max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 p-8">
        <form action={updateTemplate} className="space-y-6">
          <input type="hidden" name="id" value={template.id} />

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Template Name
            </label>
            <input
              type="text"
              name="name"
              required
              defaultValue={template.name}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Default Subject Line
            </label>
            <input
              type="text"
              name="subject"
              required
              defaultValue={template.subject}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Plain Text Body
            </label>
            <textarea
              name="body"
              required
              rows={8}
              defaultValue={template.body}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              HTML Email
            </label>
            <textarea
              name="html"
              rows={14}
              defaultValue={template.html ?? ""}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 font-mono text-sm text-white outline-none focus:border-orange-500"
            />
          </div>

          <SubmitButton pendingText="Saving...">Save Changes</SubmitButton>
        </form>

        <div className="mt-10 border-t border-slate-800 pt-8">
          <h3 className="text-sm font-semibold text-red-400">Danger zone</h3>
          <p className="mt-2 text-sm text-slate-500">
            Deleting this template won&apos;t affect campaigns that already used it.
          </p>
          <form action={deleteTemplate} className="mt-4">
            <input type="hidden" name="id" value={template.id} />
            <button
              type="submit"
              className="rounded-lg border border-red-500/40 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/10"
            >
              Delete template
            </button>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
