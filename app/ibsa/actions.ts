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

export async function createConvention(formData: FormData) {
  const name           = formData.get("name")?.toString().trim() ?? "";
  const venue          = formData.get("venue")?.toString().trim() || null;
  const conventionDate = formData.get("conventionDate")?.toString() ?? "";
  const deliveryDate   = formData.get("deliveryDate")?.toString() || null;
  const deliveryAddress = formData.get("deliveryAddress")?.toString().trim() || null;
  const contactName    = formData.get("contactName")?.toString().trim() || null;
  const contactEmail   = formData.get("contactEmail")?.toString().trim() || null;
  const contactMobile  = formData.get("contactMobile")?.toString().trim() || null;
  const faEnabled  = formData.get("faEnabled") === "true";
  const rawType    = formData.get("eventType")?.toString().trim() ?? "regional";
  const eventType  = (rawType === "circuit" || rawType === "congregation") ? rawType : "regional";

  if (!name || !conventionDate) return;

  await prisma.ibsaConvention.create({
    data: {
      name,
      venue,
      eventType,
      conventionDate: new Date(conventionDate),
      deliveryDate:   deliveryDate ? new Date(deliveryDate) : null,
      deliveryAddress,
      contactName,
      contactEmail,
      contactMobile,
      status:    "pending",
      faStatus:  "pending",
      faEnabled,
    },
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
