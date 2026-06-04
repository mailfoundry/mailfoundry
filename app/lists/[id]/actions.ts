"use server";

import { prisma } from "../../../src/lib/prisma";
import { redirect } from "next/navigation";

export async function addContactToList(listId: string, formData: FormData) {
  const contactId = formData.get("contactId")?.toString();

  if (!contactId) {
    throw new Error("Contact is required");
  }

  await prisma.contactList.upsert({
    where: {
      contactId_listId: {
        contactId,
        listId,
      },
    },
    update: {},
    create: {
      contactId,
      listId,
    },
  });

  redirect(`/lists/${listId}`);
}

export async function removeContactFromList(listId: string, formData: FormData) {
  const contactId = formData.get("contactId")?.toString();

  if (!contactId) {
    throw new Error("Contact is required");
  }

  await prisma.contactList.delete({
    where: {
      contactId_listId: {
        contactId,
        listId,
      },
    },
  });

  redirect(`/lists/${listId}`);
}