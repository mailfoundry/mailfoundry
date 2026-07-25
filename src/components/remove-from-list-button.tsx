"use client";

import { useState } from "react";

type RemoveFromListButtonProps = {
  contactId: string;
  removeAction: (formData: FormData) => Promise<void>;
};

export default function RemoveFromListButton({
  contactId,
  removeAction,
}: RemoveFromListButtonProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  if (isConfirming) {
    return (
      <div className="flex items-center gap-2">
        <form action={removeAction}>
          <input type="hidden" name="contactId" value={contactId} />

          <button
            type="submit"
            className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-gray-900 hover:bg-red-500"
          >
            Yes, remove
          </button>
        </form>

        <button
          type="button"
          onClick={() => setIsConfirming(false)}
          className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-100"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsConfirming(true)}
      className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-100"
    >
      Remove
    </button>
  );
}
