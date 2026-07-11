-- Add supplier field to RsProduct, defaulting to "Robert Scott" for all existing rows

ALTER TABLE "RsProduct" ADD COLUMN "supplier" TEXT NOT NULL DEFAULT 'Robert Scott';
