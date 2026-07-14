-- Migration: Add IbsaProductBom table
-- Run from ~/sendforge:
--   export $(grep DATABASE_URL .env | tr -d '"')
--   psql "$DATABASE_URL" -f scripts/migrate-bom.sql
-- Then regenerate the Prisma client:
--   npx prisma generate

CREATE TABLE IF NOT EXISTS "IbsaProductBom" (
  "id"          TEXT NOT NULL,
  "compositeId" TEXT NOT NULL,
  "componentId" TEXT NOT NULL,
  "qty"         INTEGER NOT NULL DEFAULT 1,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "IbsaProductBom_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "IbsaProductBom_compositeId_fkey"
    FOREIGN KEY ("compositeId") REFERENCES "IbsaProduct"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "IbsaProductBom_componentId_fkey"
    FOREIGN KEY ("componentId") REFERENCES "IbsaProduct"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "IbsaProductBom_compositeId_componentId_key"
    UNIQUE ("compositeId", "componentId")
);

CREATE INDEX IF NOT EXISTS "IbsaProductBom_componentId_idx"
  ON "IbsaProductBom"("componentId");
