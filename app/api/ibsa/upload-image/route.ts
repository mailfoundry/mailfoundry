import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: Request): Promise<NextResponse> {
  const cookieStore = await cookies();
  const ibsaAuth = cookieStore.get("ibsa_auth");
  const mainAuth = cookieStore.get("main_auth");
  if (!ibsaAuth?.value && !mainAuth?.value) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file || file.size === 0) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    const ext = file.name.split(".").pop() ?? "bin";
    const filename = `product-images/${Date.now()}.${ext}`;
    const blob = await put(filename, file, { access: "public" });
    return NextResponse.json({ url: blob.url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
