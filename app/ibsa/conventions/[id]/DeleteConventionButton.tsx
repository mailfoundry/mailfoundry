"use client";

import { useRef } from "react";
import { deleteConvention } from "./actions";

export default function DeleteConventionButton({
  conventionId,
  conventionName,
}: {
  conventionId: string;
  conventionName: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  function handleClick() {
    if (
      window.confirm(
        `Permanently delete "${conventionName}"?\n\nThis will remove the convention and all its order data. This cannot be undone.`
      )
    ) {
      formRef.current?.requestSubmit();
    }
  }

  return (
    <form ref={formRef} action={deleteConvention}>
      <input type="hidden" name="conventionId" value={conventionId} />
      <button
        type="button"
        onClick={handleClick}
        className="rounded-lg border border-red-900/50 px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-950/40 hover:text-red-400 transition-colors"
      >
        Delete convention
      </button>
    </form>
  );
}
