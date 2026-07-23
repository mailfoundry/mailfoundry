"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
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
  const expiresAt  = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

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
    text: `Click a link below to open your convention order form. Links expire in 24 hours.\n\n${linksText}\n\nIf you didn't request this email you can safely ignore it.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;">
        <div style="background:#0f172a;padding:32px;border-radius:12px;">
          <p style="color:#f97316;font-size:18px;font-weight:bold;margin:0 0 8px;">IBSA · Xylo (UK) Ltd</p>
          <h1 style="color:#fff;font-size:22px;margin:0 0 8px;">Your order form${links.length > 1 ? "s" : ""}</h1>
          <p style="color:#94a3b8;margin:0 0 20px;">Click below to fill in your product requirements. Links expire in 24 hours.</p>
          ${linksHtml}
          <p style="color:#475569;font-size:12px;margin:20px 0 0;">If you didn't request this email you can safely ignore it.</p>
        </div>
      </div>
    `,
  });

  redirect(`/convention/check-email?email=${encodeURIComponent(email)}`);
}

const IBSA_NOTIFY_EMAIL = "ibsa@xylouk.co.uk";

/** Step 2: overseer clicks the magic link — verify token and set cookie */
export async function verifyConventionToken(formData: FormData) {
  const token = (formData.get("token") as string).trim();
  if (!token) redirect("/convention?error=invalid-token");

  const record = await prisma.conventionOrderToken.findUnique({ where: { token } });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    redirect("/convention?error=invalid-token");
  }

  // Skip access notification for internal preview tokens
  if (record.email !== "preview@xylo.internal") {
    const convention = await prisma.ibsaConvention.findUnique({
      where: { id: record.conventionId },
      select: { name: true, venue: true, conventionDate: true },
    });
    if (convention) {
      const dateStr = convention.conventionDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
      await sendEmail({
        to: IBSA_NOTIFY_EMAIL,
        subject: `Order form accessed — ${convention.name}${convention.venue ? ` (${convention.venue})` : ""}`,
        text: `The order form for ${convention.name} (${dateStr}) has been opened by ${record.email}.`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;">
            <div style="background:#0f172a;padding:32px;border-radius:12px;">
              <p style="color:#f97316;font-size:16px;font-weight:bold;margin:0 0 8px;">IBSA · Xylo (UK) Ltd</p>
              <h1 style="color:#fff;font-size:20px;margin:0 0 16px;">Order form accessed</h1>
              <p style="color:#94a3b8;margin:0 0 8px;font-size:14px;"><strong style="color:#f1f5f9;">${convention.name}${convention.venue ? ` (${convention.venue})` : ""}</strong> · ${dateStr}</p>
              <p style="color:#94a3b8;font-size:14px;margin:0;">Opened by <strong style="color:#f1f5f9;">${record.email}</strong></p>
            </div>
          </div>
        `,
      }).catch(() => {}); // don't block the redirect if email fails
    }
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

/** Notify IBSA that the convention team has completed their order review */
export async function notifyOrderConfirmed(formData: FormData) {
  const conventionId = (formData.get("conventionId") as string).trim();
  if (!conventionId) return;

  const convention = await prisma.ibsaConvention.findUnique({
    where: { id: conventionId },
    select: { name: true, venue: true, conventionDate: true, contactName: true, contactEmail: true },
  });
  if (!convention) return;

  const dateStr = convention.conventionDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const displayName = convention.contactName || convention.contactEmail || "The convention team";

  await sendEmail({
    to: IBSA_NOTIFY_EMAIL,
    subject: `Order confirmed — ${convention.name}${convention.venue ? ` (${convention.venue})` : ""}`,
    text: `${displayName} has confirmed their order for ${convention.name} (${dateStr}). All sections have been reviewed and marked as correct.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;">
        <div style="background:#0f172a;padding:32px;border-radius:12px;">
          <p style="color:#f97316;font-size:16px;font-weight:bold;margin:0 0 8px;">IBSA · Xylo (UK) Ltd</p>
          <h1 style="color:#fff;font-size:20px;margin:0 0 16px;">Order confirmed ✓</h1>
          <p style="color:#94a3b8;margin:0 0 8px;font-size:14px;"><strong style="color:#f1f5f9;">${convention.name}${convention.venue ? ` (${convention.venue})` : ""}</strong> · ${dateStr}</p>
          <p style="color:#94a3b8;font-size:14px;margin:0;">Confirmed by <strong style="color:#f1f5f9;">${displayName}</strong>. All sections reviewed and marked as correct.</p>
        </div>
      </div>
    `,
  });
}

/** Save convention details (contact info, delivery address, dates) */
export async function saveConventionDetails(formData: FormData) {
  const conventionId = (formData.get("conventionId") as string).trim();
  if (!conventionId) return;

  const str = (key: string) => (formData.get(key) as string | null)?.trim() || null;

  await prisma.ibsaConvention.update({
    where: { id: conventionId },
    data: {
      name:                  (formData.get("name") as string).trim() || undefined,
      conventionDate:        formData.get("conventionDate") ? new Date(formData.get("conventionDate") as string) : undefined,
      deliveryDate:          formData.get("deliveryDate") ? new Date(formData.get("deliveryDate") as string) : null,
      contactName:           str("contactName"),
      contactEmail:          str("contactEmail"),
      contactMobile:         str("contactMobile"),
      cleaningOverseerName:  str("cleaningOverseerName"),
      cleaningOverseerEmail: str("cleaningOverseerEmail"),
      cleaningOverseerMobile:str("cleaningOverseerMobile"),
      deliveryAddress:       str("deliveryAddress"),
      deliveryContactName:   str("deliveryContactName"),
      deliveryContactEmail:  str("deliveryContactEmail"),
      deliveryContactMobile: str("deliveryContactMobile"),
    },
  });

  revalidatePath(`/ibsa/conventions/${conventionId}`);
  revalidatePath("/ibsa");
}

/** Convention team confirms the order is correct — locks the form */
export async function confirmOrder(formData: FormData) {
  const conventionId = (formData.get("conventionId") as string).trim();
  const dept = (formData.get("dept") as string).trim() as "CS" | "FA";
  if (!conventionId) return;

  await prisma.ibsaConvention.update({
    where: { id: conventionId },
    data: dept === "FA" ? { faStatus: "ordered" } : { status: "ordered" },
  });

  revalidatePath(`/convention/${conventionId}`);
  revalidatePath(`/ibsa/conventions/${conventionId}`);
  revalidatePath("/ibsa");
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
      where: { conventionId_productId_dept: { conventionId, productId, dept } },
      create: { conventionId, productId, qty, dept },
      update: { qty, dept },
    });
  }
}
