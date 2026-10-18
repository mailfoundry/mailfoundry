/**
 * Server-side auth helpers (server components, server actions, route handlers).
 * proxy.ts imports session.ts directly — this file uses next/headers.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_NAME, sessionCookieOptions, signSession, verifySession, type SessionKind } from "./session";

async function read(kind: SessionKind): Promise<string | null> {
  const jar = await cookies();
  return verifySession(jar.get(COOKIE_NAME[kind])?.value, kind);
}

/** Main MailFoundry user (email of the signed-in admin), or null. */
export const getMainUser = () => read("main");
/** IBSA admin user id, or null. */
export const getIbsaUser = () => read("ibsa");
/** Group account id (customer portal), or null. */
export const getGroupAccountId = () => read("group");
/** Convention id the overseer is authorised for, or null. */
export const getConventionId = () => read("conv");

export async function isMainOrIbsa(): Promise<boolean> {
  const [m, i] = await Promise.all([getMainUser(), getIbsaUser()]);
  return !!(m || i);
}

/** Throws unless a main user is signed in (for server actions). */
export async function requireMain(): Promise<string> {
  const u = await getMainUser();
  if (!u) throw new Error("Unauthorised");
  return u;
}

/** Redirects to login unless a main user or IBSA admin is signed in. */
export async function requireMainOrIbsa(): Promise<void> {
  if (!(await isMainOrIbsa())) redirect("/login");
}

/** Sign and set a session cookie. */
export async function startSession(kind: SessionKind, sub: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAME[kind], await signSession(kind, sub), sessionCookieOptions(kind));
}

export async function endSession(kind: SessionKind): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME[kind]);
}
