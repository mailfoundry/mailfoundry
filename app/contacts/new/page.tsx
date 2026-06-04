import Link from "next/link";
import { createContact } from "./actions";
import AppShell from "../../../src/components/app-shell";

export default function NewContactPage() {
  return (
    <AppShell active="contacts">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">Audience</p>
          <h2 className="text-3xl font-bold">Add Contact</h2>
        </div>

        <Link
          href="/contacts"
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
        >
          Back to Contacts
        </Link>
      </header>

      <div className="max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-8">
        <form action={createContact} className="space-y-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Email
            </label>
            <input
              type="email"
              name="email"
              required
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none"
              placeholder="name@example.com"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              First Name
            </label>
            <input
              type="text"
              name="firstName"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none"
              placeholder="Jason"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Last Name
            </label>
            <input
              type="text"
              name="lastName"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none"
              placeholder="Ridge"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Contact Status
            </label>
            <select
              name="contactStatus"
              defaultValue="subscribed"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none"
            >
              <option value="subscribed">Subscribed</option>
              <option value="unknown">Unknown</option>
            </select>
            <p className="mt-2 text-sm text-slate-500">
              Subscribed contacts are eligible to receive campaigns. Unknown
              contacts are saved but will be skipped until marked as subscribed.
            </p>
          </div>

          <button
            type="submit"
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900"
          >
            Save Contact
          </button>
        </form>
      </div>
    </AppShell>
  );
}
