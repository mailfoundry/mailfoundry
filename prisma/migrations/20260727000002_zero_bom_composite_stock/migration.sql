-- BOM composite products should carry no stock of their own.
-- Stock lives on the individual components instead.
UPDATE "IbsaProduct"
SET "inStock" = 0,
    "git"     = 0
WHERE id IN (
  SELECT DISTINCT "compositeId" FROM "IbsaProductBom"
);
