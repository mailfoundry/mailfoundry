-- Move handle products into the 'handles' category so they appear
-- in the 'Brushes & Handles' group on the order form.
UPDATE "IbsaProduct"
SET "category" = 'handles'
WHERE "name" ILIKE '%handle%'
  AND "type" = 'CS';
