"use server";

import { prisma } from "../../../src/lib/prisma";
import { revalidatePath } from "next/cache";

type ImportLine = {
  productId: string;
  qty: number;
  dept: string;
};

export async function createGroupOrderFromImport(formData: FormData) {
  const groupType    = (formData.get("groupType")    as string).trim();
  const groupName    = (formData.get("groupName")    as string).trim();
  const contactName  = (formData.get("contactName")  as string).trim();
  const contactEmail = (formData.get("contactEmail") as string).trim();
  const contactMobile = (formData.get("contactMobile") as string | null)?.trim() ?? null;
  const dept         = (formData.get("dept")         as string).trim() || "CS";
  const lines: ImportLine[] = JSON.parse(formData.get("lines") as string);

  if (!groupName || !contactEmail || lines.length === 0) {
    throw new Error("Missing required fields");
  }

  await prisma.ibsaGroupOrder.create({
    data: {
      groupType,
      groupName,
      contactName,
      contactEmail,
      contactMobile: contactMobile || null,
      status: "submitted",
      lines: {
        create: lines.map((l) => ({
          productId: l.productId,
          dept,
          qty: l.qty,
        })),
      },
    },
  });

  revalidatePath("/ibsa/orders");
}
