"use client";

import { useFormStatus } from "react-dom";

type SubmitButtonProps = {
  children: string;
  pendingText?: string;
};

export default function SubmitButton({
  children,
  pendingText = "Saving...",
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? pendingText : children}
    </button>
  );
}