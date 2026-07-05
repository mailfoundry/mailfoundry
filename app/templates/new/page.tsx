import Link from "next/link";
import AppShell from "../../../src/components/app-shell";
import SubmitButton from "../../../src/components/submit-button";
import { createTemplate } from "./actions";

export default function NewTemplatePage() {
  return (
    <AppShell active="templates">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">Content</p>
          <h2 className="text-3xl font-bold">New Template</h2>
        </div>
        <Link
          href="/templates"
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
        >
          Back to Templates
        </Link>
      </header>

      <div className="max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 p-8">
        <form action={createTemplate} className="space-y-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Template Name
            </label>
            <input
              type="text"
              name="name"
              required
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-orange-500"
              placeholder="Monthly newsletter"
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
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-orange-500"
              placeholder="Your subject line here"
            />
            <p className="mt-2 text-sm text-slate-500">
              This can be overridden when creating a campaign from this template.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Plain Text Body
            </label>
            <textarea
              name="body"
              required
              rows={8}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-orange-500"
              placeholder="Write your email content here..."
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              HTML Email
            </label>
            <textarea
              name="html"
              rows={14}
              placeholder="Paste your full HTML email here..."
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 font-mono text-sm text-white outline-none focus:border-orange-500"
            />
            <p className="mt-2 text-sm text-slate-500">
              Optional. If blank, plain text body will be used.
            </p>
          </div>

          <SubmitButton pendingText="Saving...">Save Template</SubmitButton>
        </form>
      </div>
    </AppShell>
  );
}
