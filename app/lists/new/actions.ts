"use server";

import { prisma } from "../../../src/lib/prisma";
import { redirect } from "next/navigation";

export async function createList(formData: FormData) {
  const name = formData.get("name")?.toString().trim() || "";

  if (!name) {
    throw new Error("List name is required");
  }

  const existingList = await prisma.list.findFirst({
    where: {
      name,
    },
  });

  if (existingList) {
    throw new Error("A list with this name already exists");
  }

  await prisma.list.create({
    data: {
      name,
    },
  });

  redirect("/lists");
}
