"use client";

import { useEffect, useRef, useState } from "react";
import AppShell from "../../../src/components/app-shell";
import Link from "next/link";

type List = { id: string; name: string };

type ImportResult = {
  email: string;
  status: "created" | "updated" | "skipped";
  reason?: string;
};

type ImportSummary = {
  created: number;
  updated: number;
  skipped: number;
  total: number;
  results: ImportResult[];
};

export default function ImportContactsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState("");
  const [lists, setLists] = useState<List[]>([]);
  const [listId, setListId] = useState("");
  const [markSubscribed, setMarkSubscribed] = useState(true);
  const [status, setStatus] = useState<"idle" | "importing" | "done" | "error">("idle");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/lists")
      .then((r) => r.json())
      .then((data) => setLists(data.lists ?? []))
      .catch(() => {});
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setCsvText(String(ev.target?.result ?? ""));
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!csvText) {
      setError("Please select a CSV file first.");
      return;
    }
    setStatus("importing");
    setError("");
    setSummary(null);

    try {
      const response = await fetch("/api/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvText, listId: listId || undefined, markSubscribed }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Import failed.");
      setSummary(data);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
      setStatus("error");
    }
  }

  function handleReset() {
    setCsvText("");
    setFileName("");
    setSummary(null);
    setStatus("idle");
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <AppShell active="contacts">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">Audience</p>
          <h2 className="text-3xl font-bold">Import Contacts</h2>
        </div>
        <Link
          href="/contacts"
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
        >
          Back to Contacts
        </Link>
      </header>

      {status !== "done" && (
        <div className="space-y-6">
          {/* CSV format hint */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h3 className="text-lg font-semibold">CSV Format</h3>
            <p className="mt-2 text-sm text-slate-400">
              Your file must have an <span className="font-medium text-white">email</span> column.
              Optional columns: <span className="text-white">firstName</span>,{" "}
              <span className="text-white">lastName</span>,{" "}
              <span className="text-white">source</span>.
            </p>
            <pre className="mt-4 rounded-lg bg-slate-950 px-4 py-3 text-xs text-slate-300">
              {`email,firstName,lastName\njane@example.com,Jane,Smith\njohn@example.com,John,`}
            </pre>
          </div>

          {/* File upload */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h3 className="mb-4 text-lg font-semibold">Select File</h3>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-700 bg-slate-950 p-8 hover:border-slate-500">
              <svg className="mb-3 h-8 w-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <span className="text-sm text-slate-400">
                {fileName ? fileName : "Click to choose a CSV file"}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>

          {/* Options */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h3 className="mb-4 text-lg font-semibold">Options</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-slate-400">Add to list (optional)</label>
                <select
                  value={listId}
                  onChange={(e) => setListId(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-white outline-none focus:border-orange-500"
                >
                  <option value="">— Don&apos;t add to a list —</option>
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>

              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={markSubscribed}
                  onChange={(e) => setMarkSubscribed(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-950 accent-orange-500"
                />
                <span className="text-sm text-slate-300">Mark new contacts as subscribed</span>
              </label>
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</p>
          )}

          <button
            type="button"
            onClick={handleImport}
            disabled={status === "importing" || !csvText}
            className="rounded-lg bg-orange-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === "importing" ? "Importing…" : "Import Contacts"}
          </button>
        </div>
      )}

      {status === "done" && summary && (
        <div className="space-y-6">
          {/* Summary stats */}
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm text-slate-400">Total Rows</p>
              <p className="mt-2 text-2xl font-bold text-white">{summary.total}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm text-slate-400">Created</p>
              <p className="mt-2 text-2xl font-bold text-green-400">{summary.created}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm text-slate-400">Updated</p>
              <p className="mt-2 text-2xl font-bold text-sky-400">{summary.updated}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm text-slate-400">Skipped</p>
              <p className="mt-2 text-2xl font-bold text-slate-400">{summary.skipped}</p>
            </div>
          </div>

          {/* Row-level results */}
          {summary.results.length > 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h3 className="mb-4 text-lg font-semibold">Results</h3>
              <div className="overflow-hidden rounded-xl border border-slate-800">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-950 text-slate-400">
                    <tr>
                      <th className="px-4 py-3 font-medium">Email</th>
                      <th className="px-4 py-3 font-medium">Result</th>
                      <th className="px-4 py-3 font-medium">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {summary.results.map((r, i) => (
                      <tr key={i}>
                        <td className="px-4 py-3 text-slate-300">{r.email}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-semibold ${
                              r.status === "created"
                                ? "bg-green-500/10 text-green-400"
                                : r.status === "updated"
                                  ? "bg-sky-500/10 text-sky-400"
                                  : "bg-slate-500/10 text-slate-400"
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500">{r.reason ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
            >
              Import Another File
            </button>
            <Link
              href="/contacts"
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900"
            >
              View Contacts
            </Link>
          </div>
        </div>
      )}
    </AppShell>
  );
}
