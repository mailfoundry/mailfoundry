"use server";

import { requireMain } from "@/src/lib/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "../../src/lib/prisma";
import { buildContactWhere, readFilterParams, hasAnyFilter, ELIGIBLE_WHERE } from "../../src/lib/segments";

const MAX_BATCH = 20000;

/**
 * Save the current segment into a list (new or existing) so a campaign can target it.
 * - Only send-eligible contacts are added (subscribed, not unsubscribed/bounced/complained/archived).
 * - Contacts already in the target list are skipped, so "add next 500" grows a warm-up list gradually;
 *   the campaign's "Continue Sending" then emails only the newly added contacts.
 */
export async function saveSegmentAsList(formData: FormData) {
  await requireMain();

  const get = (k: string) => formData.get(k)?.toString();
  const filters = readFilterParams({
    status: get("status"), country: get("country"), list: get("list"), source: get("source"),
    activity: get("activity"), campaign: get("campaign"), engagement: get("engagement"), urlContains: get("urlContains"),
  });
  if (!hasAnyFilter(filters)) throw new Error("Apply at least one filter first");

  const targetListId = get("targetListId") || "";
  const newListName = (get("newListName") || "").trim();
  const limitRaw = parseInt(get("limit") || "", 10);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, MAX_BATCH) : MAX_BATCH;

  // Resolve or create the target list
  let listId = targetListId;
  if (!listId) {
    if (!newListName) throw new Error("Choose a list or enter a new list name");
    const existing = await prisma.list.findFirst({ where: { name: newListName } });
    listId = existing ? existing.id : (await prisma.list.create({ data: { name: newListName } })).id;
  } else if (!(await prisma.list.findUnique({ where: { id: listId } }))) {
    throw new Error("List not found");
  }

  const contacts = await prisma.contact.findMany({
    where: {
      AND: [
        buildContactWhere(filters),
        ELIGIBLE_WHERE,
        { lists: { none: { listId } } }, // not already in the target list
      ],
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true },
  });

  if (contacts.length) {
    for (let i = 0; i < contacts.length; i += 1000) {
      await prisma.contactList.createMany({
        data: contacts.slice(i, i + 1000).map((c) => ({ contactId: c.id, listId })),
        skipDuplicates: true,
      });
    }
  }

  revalidatePath("/lists");
  revalidatePath(`/lists/${listId}`);
  redirect(`/lists/${listId}?added=${contacts.length}`);
}
