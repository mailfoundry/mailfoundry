"use client";

import { useState } from "react";

export default function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title, url }); return; } catch { /* cancelled */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };
  return (
    <button
      type="button"
      onClick={share}
      className="rounded-full bg-[#3d3326] px-6 py-2.5 text-sm font-medium tracking-wide text-[#faf6ef] shadow hover:bg-[#2b241b]"
    >
      {copied ? "Link copied ✓" : "Share with family & friends"}
    </button>
  );
}
