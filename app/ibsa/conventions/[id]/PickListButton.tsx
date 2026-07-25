"use client";

import { downloadPickList, type PickListLine } from "./generatePickList";

type Props = {
  conventionName: string;
  dept: "CS" | "FA";
  lines: PickListLine[];
  shippingCost: number;
};

export default function PickListButton({ conventionName, dept, lines, shippingCost }: Props) {
  if (lines.length === 0) return null;

  return (
    <button
      onClick={() => downloadPickList({ conventionName, dept, lines, shippingCost })}
      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
    >
      ↓ Pick List
    </button>
  );
}
