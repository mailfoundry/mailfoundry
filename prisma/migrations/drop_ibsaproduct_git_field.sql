-- L-3: Remove unused `git` field from IbsaProduct
-- Run this in the Neon SQL console, then mark the migration as applied.
ALTER TABLE "IbsaProduct" DROP COLUMN IF EXISTS "git";
