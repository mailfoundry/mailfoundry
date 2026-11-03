import { NextResponse } from "next/server";
import { agentRoute, apiError } from "@/src/lib/agent-auth";
import { BRAND_SITE, isBrandKey } from "@/src/lib/brand-email";

// Real products (name, page URL, hosted image) from the brand's shop, for use in campaign content.
export const GET = agentRoute("products.search", async ({ req }) => {
  const q = new URL(req.url).searchParams;
  const brand = (q.get("brand") ?? "").toLowerCase();
  if (!isBrandKey(brand)) return apiError("invalid_input", "brand must be \"scs\" or \"swf\"", 422);
  const search = (q.get("q") ?? "").trim();
  const limit = Math.min(20, Math.max(1, Number(q.get("limit")) || 10));

  const url = `${BRAND_SITE[brand]}/api/gpt/products?limit=${limit}${search ? `&q=${encodeURIComponent(search)}` : ""}`;
  let data: { products?: Record<string, unknown>[] };
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000), headers: { Accept: "application/json" } });
    if (!res.ok) return apiError("shop_unavailable", `The ${brand.toUpperCase()} shop returned ${res.status}`, 502);
    data = await res.json();
  } catch {
    return apiError("shop_unavailable", `Couldn't reach the ${brand.toUpperCase()} shop — try again shortly`, 502);
  }

  const products = (data.products ?? [])
    .filter((p) => typeof p.imageUrl === "string" && p.imageUrl)
    .map((p) => ({
      name: p.name,
      url: typeof p.url === "string" ? p.url.replace("https://staffordshire", "https://www.staffordshire") : p.url,
      imageUrl: p.imageUrl,
      price: p.priceIncVat,
      availability: p.availability,
      category: p.category,
      description: typeof p.description === "string" ? p.description.slice(0, 160) : null,
    }));
  return NextResponse.json({ brand, query: search, products });
});
