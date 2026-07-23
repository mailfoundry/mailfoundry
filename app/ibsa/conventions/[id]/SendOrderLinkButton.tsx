"use client";

import { useState, useTransition } from "react";
import { sendOrderFormLink, getOrderFormPreviewUrl } from "./actions";

export default function SendOrderLinkButton({
  conventionId,
  contactEmail,
}: {
  conventionId: string;
  contactEmail: string | null;
}) {
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isPreviewing, startPreview] = useTransition();

  function handleSend() {
    const fd = new FormData();
    fd.set("conventionId", conventionId);
    startTransition(async () => {
      const result = await sendOrderFormLink(fd);
      if (result && "ok" in result && result.ok) {
        setSentTo(result.email ?? contactEmail);
        setStatus("sent");
        setTimeout(() => setStatus("idle"), 8000);
      } else {
        setStatus("error");
        setTimeout(() => setStatus("idle"), 5000);
      }
    });
  }

  function handlePreview() {
    const fd = new FormData();
    fd.set("conventionId", conventionId);
    startPreview(async () => {
      const result = await getOrderFormPreviewUrl(fd);
      if (result && "url" in result) {
        window.open(result.url, "_blank");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Preview button — always available */}
      <button
        type="button"
        disabled={isPreviewing}
        onClick={handlePreview}
        className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isPreviewing ? "Opening…" : "Preview order form"}
      </button>

      {/* Send button — only if contact email exists */}
      {!contactEmail ? (
        <span className="text-xs text-slate-600 italic">No contact email — save one first</span>
      ) : status === "sent" ? (
        <span className="text-xs text-green-400">✓ Link sent to {sentTo}</span>
      ) : status === "error" ? (
        <span className="text-xs text-red-400">Failed to send — check contact email and try again</span>
      ) : (
        <button
          type="button"
          disabled={isPending}
          onClick={handleSend}
          className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? "Sending…" : "Send order form link"}
        </button>
      )}
    </div>
  );
}
