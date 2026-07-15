/**
 * Resolves a product imageUrl (which may be either a bare filename stored from
 * the old static-map era, or a full Vercel Blob https:// URL from the new flow)
 * into a usable <img> src string.
 */
export function getImageSrc(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  if (imageUrl.startsWith("http")) return imageUrl; // Vercel Blob URL
  return `/product-images/${imageUrl}`;              // legacy local filename
}
