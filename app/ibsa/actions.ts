"use server";

import { prisma } from "../../src/lib/prisma";
import { revalidatePath } from "next/cache";

export async function archiveConvention(formData: FormData) {
  const conventionId = formData.get("conventionId")?.toString() ?? "";
  if (!conventionId) return;
  await prisma.ibsaConvention.update({
    where: { id: conventionId },
    data: { archivedAt: new Date() },
  });
  revalidatePath("/ibsa");
}

export async function updateConventionDetails(formData: FormData) {
  const conventionId = formData.get("conventionId")?.toString() ?? "";
  const name = formData.get("name")?.toString() ?? "";
  const venue = formData.get("venue")?.toString() ?? "";
  if (!conventionId || !name) return;
  await prisma.ibsaConvention.update({
    where: { id: conventionId },
    data: {
      name: name.trim(),
      venue: venue.trim() || null,
    },
  });
  revalidatePath(`/ibsa/conventions/${conventionId}`);
  revalidatePath("/ibsa");
}
