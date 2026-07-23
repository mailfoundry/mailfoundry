-- Add faEnabled flag to IbsaConvention so the FA section can be toggled on per-convention
ALTER TABLE "IbsaConvention" ADD COLUMN "faEnabled" BOOLEAN NOT NULL DEFAULT false;
