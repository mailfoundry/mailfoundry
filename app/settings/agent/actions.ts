"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../../../src/lib/prisma";
import { requireMain } from "../../../src/lib/auth";
import { audit } from "../../../src/lib/brand-rules";
import { hashToken, newToken } from "../../../src/lib/agent-auth";

/** Creates a token and returns it ONCE. Only the hash is stored. */
export async function createAgentToken(name: string): Promise<{ token?: string; error?: string }> {
  const user = await requireMain();
  const clean = name.trim().slice(0, 40);
  if (!/^[\w .-]{2,40}$/.test(clean)) return { error: "Name: 2–40 letters, numbers, spaces, dots or dashes" };
  const token = newToken();
  await prisma.agentToken.create({ data: { name: clean, tokenHash: hashToken(token), prefix: token.slice(0, 10), createdBy: user } });
  await audit(user, "agent_token_created", { detail: { name: clean } });
  revalidatePath("/settings/agent");
  return { token };
}

export async function revokeAgentToken(id: string) {
  const user = await requireMain();
  const t = await prisma.agentToken.update({ where: { id }, data: { revokedAt: new Date() } });
  await audit(user, "agent_token_revoked", { detail: { name: t.name } });
  revalidatePath("/settings/agent");
}
