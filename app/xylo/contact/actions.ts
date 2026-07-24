"use server";

import { redirect } from "next/navigation";
import { sendEmail } from "../../../src/lib/sendEmail";

const NOTIFY_EMAILS = ["hello@xylouk.co.uk", "enquiries@xylouk.co.uk"];

export async function submitContactForm(formData: FormData) {
  const name    = (formData.get("name")    as string | null)?.trim() || "";
  const email   = (formData.get("email")   as string | null)?.trim().toLowerCase() || "";
  const company = (formData.get("company") as string | null)?.trim() || "";
  const phone   = (formData.get("phone")   as string | null)?.trim() || "";
  const message = (formData.get("message") as string | null)?.trim() || "";

  if (!name || !email || !message) {
    redirect("/contact?error=missing-fields");
  }

  const subject = `New enquiry from ${name}${company ? ` (${company})` : ""}`;

  const text = [
    `Name:    ${name}`,
    `Email:   ${email}`,
    company ? `Company: ${company}` : null,
    phone   ? `Phone:   ${phone}`   : null,
    "",
    "Message:",
    message,
  ]
    .filter((l) => l !== null)
    .join("\n");

  const html = `
    <p><strong>Name:</strong> ${name}</p>
    <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
    ${company ? `<p><strong>Company:</strong> ${company}</p>` : ""}
    ${phone   ? `<p><strong>Phone:</strong> <a href="tel:${phone}">${phone}</a></p>` : ""}
    <hr />
    <p><strong>Message:</strong></p>
    <p style="white-space:pre-wrap">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
  `;

  try {
    await sendEmail({ to: NOTIFY_EMAILS, subject, text, html });
  } catch {
    redirect("/contact?error=send-failed");
  }

  redirect("/contact?success=1");
}
