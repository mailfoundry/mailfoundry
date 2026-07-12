"use server";

import { prisma } from "../../../src/lib/prisma";
import { revalidatePath } from "next/cache";

/** Create a new supplier (name must be unique) */
export async function createSupplier(formData: FormData) {
  const name = (formData.get("name") as string).trim();
  if (!name) return;

  await prisma.ibsaSupplier.create({
    data: {
      name,
      contactName: (formData.get("contactName") as string)?.trim() || null,
      email:       (formData.get("email") as string)?.trim() || null,
      mobile:      (formData.get("mobile") as string)?.trim() || null,
      notes:       (formData.get("notes") as string)?.trim() || null,
    },
  });

  revalidatePath("/ibsa/contacts");
  revalidatePath("/ibsa/purchasing");
  revalidatePath("/ibsa/suppliers");
}

/** Update supplier contact details. If name changed, cascade to RsProduct.supplier. */
export async function updateSupplier(formData: FormData) {
  const id      = (formData.get("id") as string).trim();
  const name    = (formData.get("name") as string).trim();
  const oldName = (formData.get("oldName") as string).trim();

  if (!id || !name) return;

  const nameChanged = name !== oldName;

  await prisma.$transaction([
    prisma.ibsaSupplier.update({
      where: { id },
      data: {
        name,
        contactName: (formData.get("contactName") as string)?.trim() || null,
        email:       (formData.get("email") as string)?.trim() || null,
        mobile:      (formData.get("mobile") as string)?.trim() || null,
        notes:       (formData.get("notes") as string)?.trim() || null,
      },
    }),
    // If name changed, cascade to all RsProduct rows with the old name
    ...(nameChanged
      ? [
          prisma.rsProduct.updateMany({
            where: { supplier: oldName },
            data:  { supplier: name },
          }),
        ]
      : []),
  ]);

  revalidatePath("/ibsa/contacts");
  revalidatePath("/ibsa/purchasing");
  revalidatePath("/ibsa/suppliers");
  revalidatePath("/ibsa/products");
}

/** Delete a supplier from the contacts book (does NOT delete RS product links) */
export async function deleteSupplier(formData: FormData) {
  const id = (formData.get("id") as string).trim();
  if (!id) return;

  await prisma.ibsaSupplier.delete({ where: { id } });

  revalidatePath("/ibsa/contacts");
}
