/**
 * Bearer-token auth for the ChatGPT agent API (/api/agent/v1/*).
 * Tokens are created in Settings → ChatGPT agent access; only their SHA-256 hash is stored.
 */
import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import { audit } from "./brand-rules";

export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
export const newToken = () => `mfa_${randomBytes(32).toString("base64url")}`;

export type Agent = { id: string; name: string; actor: string };

export function apiError(code: string, message: string, status = 400, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}

/** Returns the agent, or a 401 response. */
export async function agentAuth(request: Request): Promise<Agent | NextResponse> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token.startsWith("mfa_")) return apiError("unauthorised", "Missing or invalid bearer token", 401);
  const row = await prisma.agentToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row || row.revokedAt) return apiError("unauthorised", "Missing or invalid bearer token", 401);
  // Touch lastUsedAt at most once a minute
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 60_000) {
    await prisma.agentToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  }
  return { id: row.id, name: row.name, actor: `agent:${row.name}` };
}

/** Wrap a handler: authenticate, log the call, turn thrown errors into JSON. */
export function agentRoute<P = Record<string, string>>(
  action: string,
  handler: (ctx: { req: Request; agent: Agent; params: P }) => Promise<Response>
) {
  return async (req: Request, ctx: { params: Promise<P> }) => {
    const agent = await agentAuth(req);
    if (agent instanceof NextResponse) return agent;
    const params = (ctx?.params ? await ctx.params : ({} as P)) as P;
    try {
      const res = await handler({ req, agent, params });
      if (req.method !== "GET") {
        await audit(agent.actor, `api:${action}`, {
          campaignId: (params as Record<string, string>)?.id ?? null,
          detail: { status: res.status },
        });
      }
      return res;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (err && typeof err === "object" && (err as { name?: string }).name === "CampaignInputError") {
        return apiError("invalid_input", message, 422);
      }
      console.error(`[agent-api] ${action} failed`, err);
      return apiError("server_error", "Something went wrong", 500);
    }
  };
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
