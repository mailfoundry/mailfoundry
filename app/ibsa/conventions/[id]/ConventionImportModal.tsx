"use client";

import { useState, useTransition } from "react";
import { importConventionOrder } from "./actions";

type MatchedLine = {
  code: string;
  qty: number;
  product: {
    id: string;
    code: string;
    name: string;
    variant: string | null;
    category: string;
    unitCost: number;
  };
};

type ParseResult = {
  groupName: string;
  groupType: string;
  contactName: string;
  contactEmail: string;
  contactMobile: string;
  matched: MatchedLine[];
  unmatched: string[];
};

const fmtGbp = (n: number) =>
  n.toLocaleString("en-GB", { style: "currency", currency: "GBP" });

export default function ConventionImportModal({
  conventionId,
  onClose,
}: {
  conventionId: string;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [dept, setDept] = useState("CS");
  const [, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleFile(file: File) {
    setIsParsing(true);
    setParseError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/ibsa/parse-order-xlsx", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Server error ${res.status}`);
      if ((data as ParseResult).matched.length === 0 && (data as ParseResult).unmatched.length === 0) {
        setParseError("No order lines found in this file.");
        return;
      }
      setResult(data as ParseResult);
      setStep("preview");
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Couldn't read the file.");
    } finally {
      setIsParsing(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function submit() {
    if (!result) return;
    setIsSubmitting(true);
    const fd = new FormData();
    fd.set("conventionId", conventionId);
    fd.set("dept", dept);
    fd.set("lines", JSON.stringify(result.matched.map((l) => ({ productId: l.product.id, qty: l.qty }))));
    startTransition(async () => {
      await importConventionOrder(fd);
      setStep("done");
      setIsSubmitting(false);
    });
  }

  const totalCost =
    result?.matched.reduce((s, l) => s + l.qty * l.product.unitCost, 0) ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        className="flex w-full max-w-2xl flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
        style={{ maxHeight: "90vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <h2 className="text-base font-bold text-white">Import Order from Spreadsheet</h2>
          <button onClick={onClose} className="text-xl leading-none text-slate-500 hover:text-slate-300">×</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* UPLOAD */}
          {step === "upload" && (
            <div>
              <p className="mb-4 text-sm text-slate-400">
                Upload the IBSA cleaning supplies order spreadsheet (.xlsx). Product codes and quantities
                are read automatically and set on this convention card.
              </p>
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => document.getElementById("cv-xlsx-input")?.click()}
                className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-700 bg-slate-800/40 px-6 py-12 text-center transition-colors hover:border-slate-500 hover:bg-slate-800/60"
              >
                <svg className="h-8 w-8 text-slate-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-white">Drop your .xlsx here</p>
                  <p className="mt-0.5 text-xs text-slate-500">or click to browse</p>
                </div>
                {isParsing && <p className="text-xs text-blue-400">Reading spreadsheet…</p>}
              </div>
              <input
                id="cv-xlsx-input"
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              {parseError && <p className="mt-3 text-sm text-red-400">{parseError}</p>}
            </div>
          )}

          {/* PREVIEW */}
          {step === "preview" && result && (
            <div className="space-y-5">

              {/* Dept selector */}
              <div className="flex items-center gap-3">
                <label className="text-xs text-slate-500">Import as dept:</label>
                <select
                  value={dept}
                  onChange={(e) => setDept(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white focus:border-orange-500 focus:outline-none"
                >
                  <option value="CS">CS — Cleaning Supplies</option>
                  <option value="FA">FA — First Aid</option>
                </select>
              </div>

              {/* Warning if convention already has data */}
              <div className="rounded-xl border border-amber-700/40 bg-amber-950/20 px-4 py-3 text-sm text-amber-300">
                Existing quantities for matched products will be overwritten.
              </div>

              {/* Matched lines */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {result.matched.length} line{result.matched.length !== 1 ? "s" : ""} matched
                </p>
                <div className="overflow-hidden rounded-xl border border-slate-800">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-800/60 text-xs text-slate-500">
                        <th className="px-4 py-2 text-left font-semibold uppercase tracking-wider">Product</th>
                        <th className="px-4 py-2 text-right font-semibold uppercase tracking-wider">Qty</th>
                        <th className="px-4 py-2 text-right font-semibold uppercase tracking-wider">Unit</th>
                        <th className="px-4 py-2 text-right font-semibold uppercase tracking-wider">Total</th>
                      </tr>
                    </thead>
                    <tbody className="bg-slate-900">
                      {result.matched.map((l) => (
                        <tr key={l.code} className="border-t border-slate-800">
                          <td className="px-4 py-2.5">
                            <p className="font-medium text-white">{l.product.name}</p>
                            {l.product.variant && (
                              <p className="text-xs text-slate-500">{l.product.variant}</p>
                            )}
                            <p className="font-mono text-xs text-slate-600">{l.code}</p>
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-slate-300">{l.qty}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-slate-400">{fmtGbp(l.product.unitCost)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-white">{fmtGbp(l.qty * l.product.unitCost)}</td>
                        </tr>
                      ))}
                      <tr className="border-t border-slate-700 bg-slate-900/80">
                        <td colSpan={3} className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Total</td>
                        <td className="px-4 py-2 text-right tabular-nums font-bold text-amber-400">{fmtGbp(totalCost)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Unmatched */}
              {result.unmatched.length > 0 && (
                <div className="rounded-xl border border-slate-700/40 bg-slate-800/20 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-400">
                    {result.unmatched.length} code{result.unmatched.length !== 1 ? "s" : ""} not in product catalogue — skipped:
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {result.unmatched.map((c) => (
                      <li key={c} className="font-mono text-xs text-slate-500">{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* DONE */}
          {step === "done" && (
            <div className="py-8 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-900/40 text-2xl text-green-400">✓</div>
              <p className="text-base font-semibold text-white">Order imported</p>
              <p className="mt-1 text-sm text-slate-400">
                {result?.matched.length} product{result?.matched.length !== 1 ? "s" : ""} set on this convention card.
                Refresh the page to see the updated quantities.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-800 px-6 py-4">
          {step === "done" ? (
            <button
              onClick={onClose}
              className="rounded-lg bg-slate-700 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-600"
            >
              Close
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              {step === "preview" && result && (
                <button
                  onClick={submit}
                  disabled={isSubmitting || result.matched.length === 0}
                  className="rounded-lg bg-orange-600 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-500 disabled:opacity-50"
                >
                  {isSubmitting
                    ? "Importing…"
                    : `Set ${result.matched.length} product${result.matched.length !== 1 ? "s" : ""} on convention`}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
