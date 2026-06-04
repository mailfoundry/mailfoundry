import Link from "next/link";
import { createList } from "./actions";
import AppShell from "../../../src/components/app-shell";

export default function NewListPage() {
  return (
    <AppShell active="lists">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">Audience</p>
          <h2 className="text-3xl font-bold">Add List</h2>
        </div>

        <Link
          href="/lists"
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
        >
          Back to Lists
        </Link>
      </header>

      <div className="max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-8">
        <form action={createList} className="space-y-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              List Name
            </label>
            <input
              type="text"
              name="name"
              required
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none"
              placeholder="SWF Customers"
            />
          </div>

          <button
            type="submit"
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900"
          >
            Save List
          </button>
        </form>
      </div>
    </AppShell>
  );
}