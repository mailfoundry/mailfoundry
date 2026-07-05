"use server";

import { prisma } from "../../../src/lib/prisma";
import { redirect } from "next/navigation";

export async function updateTemplate(formData: FormData) {
  const id = formData.get("id")?.toString() || "";
  const name = formData.get("name")?.toString().trim() || "";
  const subject = formData.get("subject")?.toString().trim() || "";
  const body = formData.get("body")?.toString().trim() || "";
  const html = formData.get("html")?.toString().trim() || "";

  if (!id || !name || !subject || !body) {
    throw new Error("Name, subject and body are required");
  }

  await prisma.template.update({
    where: { id },
    data: { name, subject, body, html: html || null },
  });

  redirect("/templates");
}

export async function deleteTemplate(formData: FormData) {
  const id = formData.get("id")?.toString() || "";
  if (!id) throw new Error("Template ID required");

  await prisma.template.delete({ where: { id } });
  redirect("/templates");
}
