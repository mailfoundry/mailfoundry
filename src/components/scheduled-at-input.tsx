"use client";

import { useEffect, useRef } from "react";

export default function ScheduledAtInput({
  defaultValue,
}: {
  defaultValue?: string;
}) {
  const localRef = useRef<HTMLInputElement>(null);
  const utcRef   = useRef<HTMLInputElement>(null);

  function syncUtc() {
    const v = localRef.current?.value ?? "";
    if (utcRef.current) {
      utcRef.current.value = v ? new Date(v).toISOString() : "";
    }
  }

  useEffect(() => {
    syncUtc();
    localRef.current?.addEventListener("change", syncUtc);
    return () => localRef.current?.removeEventListener("change", syncUtc);
  }, []);

  return (
    <>
      <input
        ref={localRef}
        type="datetime-local"
        id="scheduledAtLocal"
        name="scheduledAt"
        defaultValue={defaultValue ?? ""}
        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none focus:border-orange-500"
      />
      <input ref={utcRef} type="hidden" name="scheduledAtUtc" id="scheduledAtUtc" />
    </>
  );
}
