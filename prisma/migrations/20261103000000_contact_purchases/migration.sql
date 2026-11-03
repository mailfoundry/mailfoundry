-- Web-shop purchase history on contacts (synced nightly from the shop)
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "swfLastOrderAt" TIMESTAMP(3);
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "swfOrders" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "scsLastOrderAt" TIMESTAMP(3);
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "scsOrders" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "purchasesSyncedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Contact_swfLastOrderAt_idx" ON "Contact"("swfLastOrderAt");
CREATE INDEX IF NOT EXISTS "Contact_scsLastOrderAt_idx" ON "Contact"("scsLastOrderAt");
