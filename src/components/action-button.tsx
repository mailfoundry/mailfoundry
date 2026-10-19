"use client";

import { useFormStatus } from "react-dom";

/**
 * Submit button for server-action forms: shows a spinner + "…ing" text and disables itself
 * the moment it's clicked, so there's instant feedback while the action runs.
 */
export default function ActionButton({
  children,
  pendingText,
  className = "",
  disabled = false,
}: {
  children: React.ReactNode;
  pendingText: string;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending}
      className={`inline-flex items-center gap-2 transition active:scale-[0.97] disabled:cursor-not-allowed ${pending ? "opacity-80" : "disabled:opacity-40"} ${className}`}
    >
      {pending && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
          <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        </svg>
      )}
      {pending ? pendingText : children}
    </button>
  );
}
