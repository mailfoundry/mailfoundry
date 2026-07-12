-- CreateTable
CREATE TABLE "IbsaSupplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "email" TEXT,
    "mobile" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IbsaSupplier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IbsaSupplier_name_key" ON "IbsaSupplier"("name");

-- Seed from existing distinct supplier names in RsProduct
INSERT INTO "IbsaSupplier" ("id", "name", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    supplier,
    NOW(),
    NOW()
FROM (
    SELECT DISTINCT supplier FROM "RsProduct" WHERE supplier IS NOT NULL AND supplier != ''
) AS distinct_suppliers
ON CONFLICT ("name") DO NOTHING;
