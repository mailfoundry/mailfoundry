-- CreateTable: RsProduct
-- Stores the Robert Scott product catalogue, mapping RS catalog codes to Xylo products.
-- One Xylo product may require multiple RS lines (e.g. brush head + handle sold separately).

CREATE TABLE "RsProduct" (
    "id"            TEXT NOT NULL,
    "rsCode"        TEXT NOT NULL,
    "rsVariant"     TEXT,
    "rsDescription" TEXT NOT NULL,
    "cartonSize"    INTEGER NOT NULL,
    "cartonPrice"   DOUBLE PRECISION NOT NULL,
    "ibsaProductId" TEXT,
    "notes"         TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RsProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RsProduct_rsCode_idx" ON "RsProduct"("rsCode");
CREATE INDEX "RsProduct_ibsaProductId_idx" ON "RsProduct"("ibsaProductId");

-- AddForeignKey
ALTER TABLE "RsProduct" ADD CONSTRAINT "RsProduct_ibsaProductId_fkey"
    FOREIGN KEY ("ibsaProductId") REFERENCES "IbsaProduct"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
