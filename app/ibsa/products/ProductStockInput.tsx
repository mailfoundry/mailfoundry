"use client";

import { useRef, useTransition } from "react";
import { updateProductStock } from "./actions";

type Props = {
  productId: string;
  inStock: number;
  git: number;
};

export default function ProductStockInput({ productId, inStock, git }: Props) {
  const inStockRef = useRef<HTMLInputElement>(null);
  const gitRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  const save = () => {
    const newInStock = parseInt(inStockRef.current?.value ?? "0") || 0;
    const newGit = parseInt(gitRef.current?.value ?? "0") || 0;
    const formData = new FormData();
    formData.append("productId", productId);
    formData.append("inStock", String(newInStock));
    formData.append("git", String(newGit));
    startTransition(() => updateProductStock(formData));
  };

  return (
    <>
      <td className="px-5 py-3 text-right">
        <input
          ref={inStockRef}
          type="number"
          min="0"
          defaultValue={inStock}
          onBlur={save}
          className={`w-20 rounded border bg-slate-700 px-2 py-1 text-right text-white outline-none focus:border-green-400 ${
            isPending ? "border-slate-400 opacity-60" : "border-slate-500"
          }`}
        />
      </td>
      <td className="px-5 py-3 text-right">
        <input
          ref={gitRef}
          type="number"
          min="0"
          defaultValue={git}
          onBlur={save}
          className={`w-20 rounded border bg-slate-700 px-2 py-1 text-right text-white outline-none focus:border-amber-400 ${
            isPending ? "border-slate-400 opacity-60" : "border-slate-500"
          }`}
        />
      </td>
    </>
  );
}
