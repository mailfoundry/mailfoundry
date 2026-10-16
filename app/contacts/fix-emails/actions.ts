"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "../../../src/lib/prisma";
import { checkEmail } from "./logic";

/**
 * Apply email fixes (recomputed server-side):
 *  - typo with a clear correction → update the address, unless the corrected address already exists
 *    as another contact, in which case archive this duplicate
 *  - invalid address → archive
 */
export async function applyEmailFixes() {
  const cookieName = process.env.APP_AUTH_COOKIE || "mailfoundry_auth";
  if ((await cookies()).get(cookieName)?.value !== "1") throw new Error("Unauthorised");

  const contacts = await prisma.contact.findMany({
    where: { archivedAt: null },
    select: { id: true, email: true },
  });
  const existing = new Set((await prisma.contact.findMany({ select: { email: true } })).map((c) => c.email.toLowerCase()));

  let fixed = 0;
  let archived = 0;
  const now = new Date();

  for (const c of contacts) {
    const issue = checkEmail(c.email);
    if (!issue) continue;
    if (issue.kind === "fix" && !existing.has(issue.suggested)) {
      await prisma.contact.update({ where: { id: c.id }, data: { email: issue.suggested } });
      existing.add(issue.suggested);
      fixed++;
    } else {
      await prisma.contact.update({ where: { id: c.id }, data: { archivedAt: now } });
      archived++;
    }
  }

  revalidatePath("/contacts");
  redirect(`/contacts/fix-emails?fixed=${fixed}&archived=${archived}`);
}
