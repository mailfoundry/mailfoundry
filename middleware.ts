import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const hostname = request.headers.get("host") ?? "";
  const isXylo =
    hostname === "www.xylouk.co.uk" || hostname === "xylouk.co.uk";

  if (isXylo) {
    const url = request.nextUrl.clone();
    url.pathname = "/xylo";
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/"],
};
