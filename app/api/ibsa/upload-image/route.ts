import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

export async function POST(request: Request): Promise<NextResponse> {
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
