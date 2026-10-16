-- Extra SKUs (e.g. SCS website SKUs) that map to an IBSA product
CREATE TABLE IF NOT EXISTS "IbsaSkuAlias" (
  "sku"       TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IbsaSkuAlias_pkey" PRIMARY KEY ("sku"),
  CONSTRAINT "IbsaSkuAlias_productId_fkey" FOREIGN KEY ("productId") REFERENCES "IbsaProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "IbsaSkuAlias_productId_idx" ON "IbsaSkuAlias"("productId");
