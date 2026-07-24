import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "../../../src/lib/prisma";

type Props = { searchParams: Promise<{ token?: string }> };

export default async function VerifyPage({ searchParams }: Props) {
  const { token } = await searchParams;

  if (!token) redirect("/account/login?error=invalid-token");

  const record = await prisma.groupAccountToken.findUnique({
    where: { token },
    include: { groupAccount: true },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    redirect("/account/login?error=invalid-token");
  }

  // Mark token as used
  await prisma.groupAccountToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });

  // Set session cookie
  const jar = await cookies();
  jar.set("group_auth", record.groupAccountId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  redirect("/account");
}
