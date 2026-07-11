-- Make catalog fields nullable on RsProduct.
-- Allows supplier-only links to exist before catalog codes/pricing are entered.

ALTER TABLE "RsProduct" ALTER COLUMN "rsCode"        DROP NOT NULL;
ALTER TABLE "RsProduct" ALTER COLUMN "rsDescription" DROP NOT NULL;
ALTER TABLE "RsProduct" ALTER COLUMN "cartonSize"    DROP NOT NULL;
ALTER TABLE "RsProduct" ALTER COLUMN "cartonPrice"   DROP NOT NULL;
