"use client";

import { useState, useTransition } from "react";
import { sendOrderFormLink } from "./actions";

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

  function handleSend() {
    const fd = new FormData();
    fd.set("conventionId", conventionId);

    startTransition(async () => {
      const result = await sendOrderFormLink(fd);
      if (result && "ok" in result && result.ok) {
        setSentTo(result.email ?? contactEmail);
        setStatus("sent");
        // Reset after 8 seconds so they can resend
        setTimeout(() => setStatus("idle"), 8000);
      } else {
        setStatus("error");
        setTimeout(() => setStatus("idle"), 5000);
      }
    });
  }

  if (!contactEmail) {
    return (
      <span className="text-xs text-slate-600 italic">No contact email — save one first</span>
    );
  }

  if (status === "sent") {
    return (
      <span className="text-xs text-green-400">
        ✓ Link sent to {sentTo}
      </span>
    );
  }

  if (status === "error") {
    return (
      <span className="text-xs text-red-400">
        Failed to send — check contact email and try again
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={handleSend}
      className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {isPending ? "Sending…" : "Send order form link"}
    </button>
  );
}
