"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "../../../src/lib/prisma";
import { proposeNameChange, type NameChange } from "./logic";

/** Apply the proposed name clean-up to every contact (recomputed server-side, never trusted from the form). */
export async function applyNameCleanup() {
  const cookieName = process.env.APP_AUTH_COOKIE || "mailfoundry_auth";
  if ((await cookies()).get(cookieName)?.value !== "1") throw new Error("Unauthorised");

  const rows = await prisma.contact.findMany({ select: { id: true, email: true, firstName: true, lastName: true } });
  const changes = rows.map(proposeNameChange).filter((c): c is NameChange => !!c);

  for (let i = 0; i < changes.length; i += 500) {
    await prisma.$transaction(
      changes.slice(i, i + 500).map((c) =>
        prisma.contact.update({ where: { id: c.id }, data: { firstName: c.newFirst, lastName: c.newLast } })
      )
    );
  }

  revalidatePath("/contacts");
  redirect(`/contacts/clean-names?applied=${changes.length}`);
}
