"use client";

import { useState } from "react";
import { createAgentToken } from "./actions";

export default function CreateToken() {
  const [name, setName] = useState("ChatGPT");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    setError("");
    const r = await createAgentToken(name);
    setBusy(false);
    if (r.error) setError(r.error);
    else setToken(r.token ?? "");
  }

  if (token) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
        <p className="font-semibold text-amber-900">Copy this token now — it won&apos;t be shown again.</p>
        <code className="mt-2 block break-all rounded bg-white p-2 font-mono text-xs">{token}</code>
        <p className="mt-2 text-amber-900">
          In the custom GPT: Configure → Actions → Authentication → API Key → Auth type <strong>Bearer</strong> → paste it. Don&apos;t paste it
          into a chat or commit it anywhere.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500">Token name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm" />
      </div>
      <button onClick={go} disabled={busy} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
        {busy ? "Creating…" : "Create token"}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </div>
  );
}
