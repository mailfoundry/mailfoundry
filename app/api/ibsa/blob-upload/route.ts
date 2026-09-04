import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: Request): Promise<NextResponse> {
  // Require IBSA or main session auth
  const cookieStore = await cookies();
  const ibsaAuth = cookieStore.get("ibsa_auth");
  const mainAuth = cookieStore.get("main_auth");
  if (!ibsaAuth?.value && !mainAuth?.value) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        return {
          allowedContentTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"],
          tokenPayload: JSON.stringify({}),
        };
      },
      onUploadCompleted: async () => {
        // No-op — we use the returned URL directly in the client
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 }
    );
  }
}
