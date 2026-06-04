"use server";

import { prisma } from "@/src/lib/prisma";
import { revalidatePath } from "next/cache";

export async function archiveContact(contactId: string) {
  await prisma.contact.update({
    where: {
      id: contactId,
    },
    data: {
      archivedAt: new Date(),
    },
  });

  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/contacts");
  revalidatePath("/reports");
}

export async function restoreContact(contactId: string) {
  await prisma.contact.update({
    where: {
      id: contactId,
    },
    data: {
      archivedAt: null,
    },
  });

  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/contacts");
  revalidatePath("/reports");
}

export async function addContactToList(contactId: string, formData: FormData) {
  const listId = formData.get("listId")?.toString();

  if (!listId) {
    return;
  }

  const existingEntry = await prisma.contactList.findFirst({
    where: {
      contactId,
      listId,
    },
  });

  if (!existingEntry) {
    await prisma.contactList.create({
      data: {
        contactId,
        listId,
      },
    });
  }

  revalidatePath(`/contacts/${contactId}`);
  revalidatePath(`/lists/${listId}`);
  revalidatePath("/lists");
}

export async function removeContactFromList(
  contactId: string,
  formData: FormData
) {
  const listId = formData.get("listId")?.toString();

  if (!listId) {
    return;
  }

  await prisma.contactList.deleteMany({
    where: {
      contactId,
      listId,
    },
  });

  revalidatePath(`/contacts/${contactId}`);
  revalidatePath(`/lists/${listId}`);
  revalidatePath("/lists");
}
