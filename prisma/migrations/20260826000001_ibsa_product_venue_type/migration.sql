-- Add venueType to IbsaProduct
-- Values: 'all' (default) | 'circuit' | 'large'
ALTER TABLE "IbsaProduct" ADD COLUMN "venueType" TEXT NOT NULL DEFAULT 'all';
