"use server";

import { prisma } from "../../../src/lib/prisma";
import { redirect } from "next/navigation";

export async function createTemplate(formData: FormData) {
  const name = formData.get("name")?.toString().trim() || "";
  const subject = formData.get("subject")?.toString().trim() || "";
  const body = formData.get("body")?.toString().trim() || "";
  const html = formData.get("html")?.toString().trim() || "";

  if (!name || !subject || !body) {
    throw new Error("Name, subject and body are required");
  }

  await prisma.template.create({
    data: { name, subject, body, html: html || null },
  });

  redirect("/templates");
}
