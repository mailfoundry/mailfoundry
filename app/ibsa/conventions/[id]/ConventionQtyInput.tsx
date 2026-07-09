"use client";

import { useRef, useTransition } from "react";
import { updateOrderQty } from "./actions";

type Props = {
  conventionId: string;
  productId: string;
  qty: number;
  dept: string;
};

export default function ConventionQtyInput({ conventionId, productId, qty, dept }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  const save = () => {
    const newQty = parseInt(inputRef.current?.value ?? "0") || 0;
    const formData = new FormData();
    formData.append("conventionId", conventionId);
    formData.append("productId", productId);
    formData.append("dept", dept);
    formData.append("qty", String(newQty));
    startTransition(() => updateOrderQty(formData));
  };

  return (
    <input
      ref={inputRef}
      type="number"
      min="0"
      defaultValue={qty || ""}
      placeholder="0"
      onBlur={save}
      className={`w-20 rounded border bg-slate-700 px-2 py-1 text-center text-white outline-none focus:border-orange-500 ${
        isPending ? "border-slate-400 opacity-60" : "border-slate-600"
      }`}
    />
  );
}
