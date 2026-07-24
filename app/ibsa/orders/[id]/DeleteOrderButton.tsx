"use client";

import { useTransition } from "react";
import { deleteOrder } from "./actions";

export default function DeleteOrderButton({
  orderId,
  groupType,
  groupName,
}: {
  orderId: string;
  groupType: string;
  groupName: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm(`Delete order from "${groupName}"? This cannot be undone.`)) return;
    const fd = new FormData();
    fd.set("orderId", orderId);
    fd.set("groupType", groupType);
    startTransition(() => deleteOrder(fd));
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={handleClick}
      className="rounded-lg border border-red-800/50 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-900/30 disabled:opacity-50 transition-colors"
    >
      {isPending ? "Deleting…" : "Delete order"}
    </button>
  );
}
