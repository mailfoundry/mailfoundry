"use client";

import { useState } from "react";
import ConventionImportModal from "./ConventionImportModal";

export default function ConventionImportButton({ conventionId }: { conventionId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {open && <ConventionImportModal conventionId={conventionId} onClose={() => setOpen(false)} />}
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
      >
        Import from xlsx
      </button>
    </>
  );
}
