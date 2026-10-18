"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "../../../src/lib/prisma";
import { requireMain } from "../../../src/lib/auth";
import { audit, LEVELS } from "../../../src/lib/brand-rules";

const back = (msg: string): never => {
  revalidatePath("/settings/brands");
  redirect(`/settings/brands?flash=${encodeURIComponent(msg)}`);
};

export async function setBrandStatus(key: string, formData: FormData) {
  const user = await requireMain();
  const status = String(formData.get("status") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || null;
  if (!(LEVELS as readonly string[]).includes(status)) back("Invalid status");
  const prev = await prisma.brand.findUnique({ where: { key } });
  await prisma.brand.update({ where: { key }, data: { status, statusReason: reason, statusSetBy: user, statusSetAt: new Date() } });
  await audit(user, "brand_status_set", { brandKey: key, detail: { from: prev?.status, to: status, reason } });
  back(`${key.toUpperCase()} set to ${status.toUpperCase()}`);
}

export async function setPostmaster(key: string, formData: FormData) {
  const user = await requireMain();
  const raw = String(formData.get("rate") ?? "").trim();
  const rate = raw === "" ? null : Number(raw);
  if (rate !== null && (!Number.isFinite(rate) || rate < 0 || rate > 100)) back("Enter a percentage, e.g. 0.05");
  await prisma.brand.update({ where: { key }, data: { postmasterSpamRate: rate, postmasterUpdatedAt: new Date() } });
  await audit(user, "postmaster_entered", { brandKey: key, detail: { rate } });
  back(`${key.toUpperCase()} Postmaster spam rate saved`);
}

export async function updateBrandRules(key: string, formData: FormData) {
  const user = await requireMain();
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const int = (k: string) => (get(k) === "" ? null : Math.max(0, Math.floor(Number(get(k)))));
  const days = get("sendDays").split(",").map((d) => d.trim()).filter((d) => /^[1-7]$/.test(d));
  const time = (v: string, fallback: string) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : fallback);
  const fromEmail = get("fromEmail").toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fromEmail)) back("Invalid From email");

  const data = {
    fromName: get("fromName") || key.toUpperCase(),
    fromEmail,
    weeklyCapPerContact: Math.max(1, int("weeklyCapPerContact") ?? 1),
    maxAudiencePerSend: int("maxAudiencePerSend"),
    sendDays: days.length ? days.join(",") : "2,3,4",
    sendWindowStart: time(get("sendWindowStart"), "10:00"),
    sendWindowEnd: time(get("sendWindowEnd"), "11:00"),
    agentSchedulingEnabled: formData.get("agentSchedulingEnabled") === "on",
  };
  await prisma.brand.update({ where: { key }, data });
  await audit(user, "brand_rules_updated", { brandKey: key, detail: data });
  back(`${key.toUpperCase()} rules saved`);
}

export async function assignList(listId: string, formData: FormData) {
  const user = await requireMain();
  const brandKey = String(formData.get("brandKey") ?? "") || null;
  const isTest = formData.get("isTest") === "on";
  if (brandKey && !(await prisma.brand.findUnique({ where: { key: brandKey } }))) back("Unknown brand");
  const list = await prisma.list.update({ where: { id: listId }, data: { brandKey, isTest } });
  // Existing unsent campaigns on this list pick up the brand on their next save; flag them now.
  await audit(user, "list_assigned", { brandKey, detail: { listId, name: list.name, isTest } });
  back(`"${list.name}" → ${brandKey ? brandKey.toUpperCase() : "unassigned"}${isTest ? " (test)" : ""}`);
}
