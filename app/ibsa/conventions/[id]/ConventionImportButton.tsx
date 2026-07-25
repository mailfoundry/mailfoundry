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
        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
      >
        Import from xlsx
      </button>
    </>
  );
}
