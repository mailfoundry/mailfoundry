import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Proxy route: fetches attributed page views for a contact from the staffordshire-hub.
 * This route is protected by the app's existing session middleware (login required).
 *
 * Requires env vars:
 *   SWF_HUB_URL        — e.g. https://app.staffordshirehub.co.uk (no trailing slash)
 *   BEHAVIOUR_SECRET   — shared secret, same value on both apps
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {

  const { id: contactId } = await params;

  const hubUrl    = process.env.SWF_HUB_URL;
  const secret    = process.env.BEHAVIOUR_SECRET;

  if (!hubUrl || !secret) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  try {
    const res = await fetch(
      `${hubUrl}/api/admin/contact-pageviews?contactId=${encodeURIComponent(contactId)}`,
      {
        headers: { Authorization: `Bearer ${secret}` },
        next:    { revalidate: 0 },
      }
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: (body as { error?: string }).error ?? "Hub error" },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Could not reach hub" }, { status: 502 });
  }
}
