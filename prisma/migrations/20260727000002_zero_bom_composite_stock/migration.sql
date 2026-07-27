-- BOM composite products should carry no stock of their own.
-- Stock lives on the individual components instead.
-- Composites are identified by a '+' in their product code (e.g. BRUSH_STIFF_28CM + HANDLE_RED).
UPDATE "IbsaProduct"
SET "inStock" = 0,
    "git"     = 0
WHERE "code" LIKE '%+%'
   OR id IN (
     SELECT DISTINCT "compositeId" FROM "IbsaProductBom"
   );
