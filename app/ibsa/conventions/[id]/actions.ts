"use server";

import { prisma } from "../../../../src/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendEmail } from "../../../../src/lib/sendEmail";

/** Send the convention order form magic link to the contact email on file */
export async function sendOrderFormLink(formData: FormData) {
  const conventionId = (formData.get("conventionId") as string).trim();
  if (!conventionId) return { error: "Missing convention ID" };

  const convention = await prisma.ibsaConvention.findUnique({
    where: { id: conventionId },
    select: { name: true, conventionDate: true, contactEmail: true },
  });

  if (!convention?.contactEmail) return { error: "No contact email on file" };

  const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
  const token      = crypto.randomUUID();
  const expiresAt  = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.conventionOrderToken.create({
    data: { token, email: convention.contactEmail, conventionId, expiresAt },
  });

  const verifyUrl = `${appBaseUrl}/convention/verify?token=${token}`;
  const date = convention.conventionDate.toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });

  try {
    await sendEmail({
      to: convention.contactEmail,
      subject: `Your order form — ${convention.name}`,
      text: `Hi,\n\nClick the link below to fill in your product requirements for ${convention.name} (${date}).\n\n${verifyUrl}\n\nThis link expires in 1 hour.\n\nIf you didn't expect this email, please ignore it.`,
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
            <tr><td align="center">
              <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

                <!-- Header -->
                <tr>
                  <td style="background:#0f172a;border-radius:12px 12px 0 0;padding:28px 36px;border-bottom:3px solid #f97316;">
                    <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#f97316;">IBSA · Xylo (UK) Ltd</p>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="background:#1e293b;padding:36px;">
                    <h1 style="margin:0 0 6px;font-size:24px;font-weight:700;color:#f1f5f9;">Your order form is ready</h1>
                    <p style="margin:0 0 28px;font-size:14px;color:#94a3b8;">Please review and submit your product requirements at your earliest convenience.</p>

                    <!-- Convention card -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:8px;margin-bottom:28px;">
                      <tr>
                        <td style="padding:18px 20px;border-left:4px solid #f97316;border-radius:0 8px 8px 0;">
                          <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#64748b;">Convention</p>
                          <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#f1f5f9;">${convention.name}</p>
                          <p style="margin:0;font-size:13px;color:#94a3b8;">${date}</p>
                        </td>
                      </tr>
                    </table>

                    <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#94a3b8;">Click the button below to open your order form. You can select the products you need and submit your requirements directly through the form. <strong style="color:#cbd5e1;">This link expires in 1 hour.</strong></p>

                    <!-- CTA -->
                    <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                      <tr>
                        <td style="background:#f97316;border-radius:8px;">
                          <a href="${verifyUrl}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#fff;text-decoration:none;letter-spacing:0.01em;">Open order form →</a>
                        </td>
                      </tr>
                    </table>

                    <p style="margin:0;font-size:12px;color:#475569;border-top:1px solid #334155;padding-top:20px;">If you have any questions, please contact the Xylo (UK) Ltd team. If you didn't expect this email, you can safely ignore it.</p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background:#0f172a;border-radius:0 0 12px 12px;padding:20px 36px;">
                    <p style="margin:0;font-size:11px;color:#475569;text-align:center;">Xylo (UK) Ltd &nbsp;·&nbsp; This is an automated message, please do not reply</p>
                  </td>
                </tr>

              </table>
            </td></tr>
          </table>
        </body>
        </html>
      `,
    });
  } catch (err) {
    console.error("sendOrderFormLink: email error", err);
    return { error: err instanceof Error ? err.message : "Failed to send email" };
  }

  return { ok: true, email: convention.contactEmail };
}

export async function updateOrderQty(formData: FormData) {
  const conventionId = formData.get("conventionId")?.toString() ?? "";
  const productId = formData.get("productId")?.toString() ?? "";
  const dept = formData.get("dept")?.toString() ?? "CS";
  const qty = parseInt(formData.get("qty")?.toString() ?? "0") || 0;

  if (!conventionId || !productId) return;

  if (qty <= 0) {
    await prisma.ibsaOrderItem.deleteMany({ where: { conventionId, productId, dept } });
  } else {
    await prisma.ibsaOrderItem.upsert({
      where: { conventionId_productId_dept: { conventionId, productId, dept } },
      create: { conventionId, productId, dept, qty },
      update: { qty },
    });
  }
  revalidatePath(`/ibsa/conventions/${conventionId}`);
}

export async function updateConventionStatus(formData: FormData) {
  const conventionId = formData.get("conventionId")?.toString() ?? "";
  const status = formData.get("status")?.toString() ?? "";
  if (!conventionId || !status) return;
  await prisma.ibsaConvention.update({ where: { id: conventionId }, data: { status } });
  revalidatePath(`/ibsa/conventions/${conventionId}`);
  revalidatePath("/ibsa");
  revalidatePath("/ibsa/purchasing");
}

/**
 * Marks a convention shipment (CS or FA) as complete AND decrements inStock
 * for every product in that shipment by its ordered qty.
 */
export async function markCompleteAndDeductStock(formData: FormData) {
  const conventionId = formData.get("conventionId")?.toString() ?? "";
  const dept = formData.get("dept")?.toString() ?? "CS"; // "CS" | "FA"
  const deductStock = formData.get("deductStock") !== "false"; // default: true
  if (!conventionId) return;

  const items = deductStock
    ? await prisma.ibsaOrderItem.findMany({
        where: { conventionId, dept },
        select: { productId: true, qty: true },
      })
    : [];

  await prisma.$transaction([
    prisma.ibsaConvention.update({
      where: { id: conventionId },
      data: dept === "FA" ? { faStatus: "complete" } : { status: "complete" },
    }),
    ...items
      .filter((i) => i.qty > 0)
      .map((i) =>
        prisma.ibsaProduct.update({
          where: { id: i.productId },
          data: { inStock: { decrement: i.qty } },
        })
      ),
  ]);

  revalidatePath(`/ibsa/conventions/${conventionId}`);
  revalidatePath("/ibsa");
  revalidatePath("/ibsa/purchasing");
  revalidatePath("/ibsa/products");
}

export async function updateShippingCost(formData: FormData) {
  const conventionId = formData.get("conventionId")?.toString() ?? "";
  const cost = parseFloat(formData.get("shippingCost")?.toString() ?? "0") || 0;
  const field = formData.get("field")?.toString() ?? "cs";
  if (!conventionId) return;
  await prisma.ibsaConvention.update({
    where: { id: conventionId },
    data: field === "fa" ? { faShippingCost: cost } : { shippingCost: cost },
  });
  revalidatePath(`/ibsa/conventions/${conventionId}`);
}

export async function updateConventionDate(formData: FormData) {
  const conventionId = formData.get("conventionId")?.toString() ?? "";
  const date = formData.get("date")?.toString() ?? "";
  if (!conventionId || !date) return;
  await prisma.ibsaConvention.update({
    where: { id: conventionId },
    data: { conventionDate: new Date(date) },
  });
  revalidatePath(`/ibsa/conventions/${conventionId}`);
  revalidatePath("/ibsa");
}

export async function updateDeliveryDate(formData: FormData) {
  const conventionId = formData.get("conventionId")?.toString() ?? "";
  const date = formData.get("date")?.toString() ?? "";
  if (!conventionId) return;
  await prisma.ibsaConvention.update({
    where: { id: conventionId },
    data: { deliveryDate: date ? new Date(date) : null },
  });
  revalidatePath(`/ibsa/conventions/${conventionId}`);
  revalidatePath("/ibsa");
}

export async function updateLogistics(formData: FormData) {
  const conventionId = formData.get("conventionId")?.toString() ?? "";
  if (!conventionId) return;

  const str = (key: string) => formData.get(key)?.toString()?.trim() || null;
  const collectionDate = formData.get("collectionDate")?.toString() ?? "";
  const paymentDueDate = formData.get("paymentDueDate")?.toString() ?? "";

  await prisma.ibsaConvention.update({
    where: { id: conventionId },
    data: {
      collectionDate:         collectionDate ? new Date(collectionDate) : null,
      paymentDueDate:         paymentDueDate ? new Date(paymentDueDate) : null,
      deliveryAddress:        str("deliveryAddress"),
      contactName:            str("contactName"),
      contactEmail:           str("contactEmail"),
      contactMobile:          str("contactMobile"),
      cleaningOverseerName:   str("cleaningOverseerName"),
      cleaningOverseerEmail:  str("cleaningOverseerEmail"),
      cleaningOverseerMobile: str("cleaningOverseerMobile"),
      deliveryContactName:    str("deliveryContactName"),
      deliveryContactEmail:   str("deliveryContactEmail"),
      deliveryContactMobile:  str("deliveryContactMobile"),
    },
  });
  revalidatePath(`/ibsa/conventions/${conventionId}`);
  revalidatePath("/ibsa");
}

export async function markPaid(formData: FormData) {
  const conventionId = formData.get("conventionId")?.toString() ?? "";
  if (!conventionId) return;
  await prisma.ibsaConvention.update({
    where: { id: conventionId },
    data: { paidAt: new Date() },
  });
  revalidatePath(`/ibsa/conventions/${conventionId}`);
  revalidatePath("/ibsa");
}

export async function markUnpaid(formData: FormData) {
  const conventionId = formData.get("conventionId")?.toString() ?? "";
  if (!conventionId) return;
  await prisma.ibsaConvention.update({
    where: { id: conventionId },
    data: { paidAt: null },
  });
  revalidatePath(`/ibsa/conventions/${conventionId}`);
  revalidatePath("/ibsa");
}

export async function enableFa(formData: FormData) {
  const conventionId = formData.get("conventionId")?.toString() ?? "";
  if (!conventionId) return;
  await prisma.ibsaConvention.update({ where: { id: conventionId }, data: { faEnabled: true } });
  revalidatePath(`/ibsa/conventions/${conventionId}`);
}

export async function updateFaStatus(formData: FormData) {
  const conventionId = formData.get("conventionId")?.toString() ?? "";
  const status = formData.get("status")?.toString() ?? "";
  if (!conventionId || !status) return;
  await prisma.ibsaConvention.update({ where: { id: conventionId }, data: { faStatus: status } });
  revalidatePath(`/ibsa/conventions/${conventionId}`);
  revalidatePath("/ibsa");
  revalidatePath("/ibsa/purchasing");
}

export async function markFaPaid(formData: FormData) {
  const conventionId = formData.get("conventionId")?.toString() ?? "";
  if (!conventionId) return;
  await prisma.ibsaConvention.update({
    where: { id: conventionId },
    data: { faPaidAt: new Date() },
  });
  revalidatePath(`/ibsa/conventions/${conventionId}`);
  revalidatePath("/ibsa");
}

export async function markFaUnpaid(formData: FormData) {
  const conventionId = formData.get("conventionId")?.toString() ?? "";
  if (!conventionId) return;
  await prisma.ibsaConvention.update({
    where: { id: conventionId },
    data: { faPaidAt: null },
  });
  revalidatePath(`/ibsa/conventions/${conventionId}`);
  revalidatePath("/ibsa");
}

export async function updateNotes(formData: FormData) {
  const conventionId = formData.get("conventionId")?.toString() ?? "";
  const notes = formData.get("notes")?.toString() ?? "";
  if (!conventionId) return;
  await prisma.ibsaConvention.update({
    where: { id: conventionId },
    data: { notes: notes.trim() || null },
  });
  revalidatePath(`/ibsa/conventions/${conventionId}`);
}

export async function importConventionOrder(formData: FormData) {
  const conventionId = formData.get("conventionId")?.toString() ?? "";
  const dept = formData.get("dept")?.toString() || "CS";
  const lines: { productId: string; qty: number }[] = JSON.parse(
    formData.get("lines")?.toString() ?? "[]"
  );
  if (!conventionId || lines.length === 0) return;

  await prisma.$transaction(
    lines.map((l) =>
      prisma.ibsaOrderItem.upsert({
        where: { conventionId_productId_dept: { conventionId, productId: l.productId, dept } },
        create: { conventionId, productId: l.productId, dept, qty: l.qty },
        update: { qty: l.qty },
      })
    )
  );

  revalidatePath(`/ibsa/conventions/${conventionId}`);
}

export async function updateFaLogistics(formData: FormData) {
  const conventionId = formData.get("conventionId")?.toString() ?? "";
  if (!conventionId) return;
  const faCollectionDate  = formData.get("faCollectionDate")?.toString() ?? "";
  const faDeliveryDate    = formData.get("faDeliveryDate")?.toString() ?? "";
  const faPaymentDueDate  = formData.get("faPaymentDueDate")?.toString() ?? "";
  const faDeliveryAddress = formData.get("faDeliveryAddress")?.toString() ?? "";
  const faShippingCost    = parseFloat(formData.get("faShippingCost")?.toString() ?? "0") || 0;
  await prisma.ibsaConvention.update({
    where: { id: conventionId },
    data: {
      faCollectionDate:  faCollectionDate  ? new Date(faCollectionDate)  : null,
      faDeliveryDate:    faDeliveryDate    ? new Date(faDeliveryDate)    : null,
      faPaymentDueDate:  faPaymentDueDate  ? new Date(faPaymentDueDate)  : null,
      faDeliveryAddress: faDeliveryAddress || null,
      faShippingCost,
    },
  });
  revalidatePath(`/ibsa/conventions/${conventionId}`);
  revalidatePath("/ibsa");
}

export async function deleteConvention(formData: FormData) {
  const conventionId = formData.get("conventionId")?.toString() ?? "";
  if (!conventionId) return;
  await prisma.ibsaConvention.delete({ where: { id: conventionId } });
  revalidatePath("/ibsa");
  redirect("/ibsa");
}
