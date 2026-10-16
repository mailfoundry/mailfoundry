-- SCS web orders → IBSA group orders (idempotent sync + one-time stock deduction)
ALTER TABLE "IbsaGroupOrder" ADD COLUMN IF NOT EXISTS "externalRef" TEXT;
ALTER TABLE "IbsaGroupOrder" ADD COLUMN IF NOT EXISTS "stockDeductedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS "IbsaGroupOrder_externalRef_key" ON "IbsaGroupOrder"("externalRef");
