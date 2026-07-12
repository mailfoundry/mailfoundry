"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "../../src/lib/prisma";
import { sendEmail } from "../../src/lib/sendEmail";

/** Step 1: overseer enters their email — find their convention and send a magic link */
export async function requestConventionLink(formData: FormData) {
  const email = (formData.get("email") as string).trim().toLowerCase();
  if (!email) redirect("/convention?error=missing-email");

  // Find upcoming non-archived conventions where contactEmail matches
  const conventions = await prisma.ibsaConvention.findMany({
    where: {
      contactEmail: { equals: email, mode: "insensitive" },
      archivedAt: null,
    },
    orderBy: { conventionDate: "asc" },
    select: { id: true, name: true, conventionDate: true },
  });

  if (conventions.length === 0) {
    redirect("/convention?error=not-found");
  }

  const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
  const expiresAt  = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  // Send one email with a link per convention (usually just one)
  const links = await Promise.all(
    conventions.map(async (c) => {
      const token = crypto.randomUUID();
      await prisma.conventionOrderToken.create({
        data: { token, email, conventionId: c.id, expiresAt },
      });
      return {
        name: c.name,
        date: c.conventionDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
        url:  `${appBaseUrl}/convention/verify?token=${token}`,
      };
    })
  );

  const linksHtml = links.map((l) => `
    <div style="background:#1e293b;border-radius:8px;padding:16px;margin-bottom:12px;">
      <p style="color:#94a3b8;font-size:12px;margin:0 0 4px;">${l.date}</p>
      <p style="color:#f1f5f9;font-size:15px;font-weight:bold;margin:0 0 12px;">${l.name}</p>
      <a href="${l.url}" style="display:inline-block;background:#f97316;color:#fff;text-decoration:none;padding:10px 22px;border-radius:8px;font-weight:bold;font-size:14px;">
        Open order form →
      </a>
    </div>
  `).join("");

  const linksText = links.map((l) => `${l.name} (${l.date})\n${l.url}`).join("\n\n");

  await sendEmail({
    to: email,
    subject: `Your IBSA convention order form${links.length > 1 ? "s" : ""}`,
    text: `Click a link below to open your convention order form. Links expire in 1 hour.\n\n${linksText}\n\nIf you didn't request this email you can safely ignore it.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;">
        <div style="background:#0f172a;padding:32px;border-radius:12px;">
          <p style="color:#f97316;font-size:18px;font-weight:bold;margin:0 0 8px;">IBSA · Xylo Supplies</p>
          <h1 style="color:#fff;font-size:22px;margin:0 0 8px;">Your order form${links.length > 1 ? "s" : ""}</h1>
          <p style="color:#94a3b8;margin:0 0 20px;">Click below to fill in your product requirements. Links expire in 1 hour.</p>
          ${linksHtml}
          <p style="color:#475569;font-size:12px;margin:20px 0 0;">If you didn't request this email you can safely ignore it.</p>
        </div>
      </div>
    `,
  });

  redirect(`/convention/check-email?email=${encodeURIComponent(email)}`);
}

/** Step 2: overseer clicks the magic link — verify token and set cookie */
export async function verifyConventionToken(formData: FormData) {
  const token = (formData.get("token") as string).trim();
  if (!token) redirect("/convention?error=invalid-token");

  const record = await prisma.conventionOrderToken.findUnique({ where: { token } });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    redirect("/convention?error=invalid-token");
  }

  await prisma.conventionOrderToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });

  const cookieStore = await cookies();
  cookieStore.set("convention_auth", record.conventionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 hours
  });

  redirect(`/convention/${record.conventionId}`);
}

/** Save order items — upserts qty per product, deletes zeroed items */
export async function saveOrderItem(formData: FormData) {
  const conventionId = (formData.get("conventionId") as string).trim();
  const productId    = (formData.get("productId") as string).trim();
  const dept         = (formData.get("dept") as string).trim() as "CS" | "FA";
  const qty          = parseInt(formData.get("qty") as string) || 0;

  if (!conventionId || !productId) return;

  if (qty <= 0) {
    await prisma.ibsaOrderItem.deleteMany({
      where: { conventionId, productId, dept },
    });
  } else {
    await prisma.ibsaOrderItem.upsert({
      where: { conventionId_productId: { conventionId, productId } },
      create: { conventionId, productId, qty, dept },
      update: { qty, dept },
    });
  }
}
