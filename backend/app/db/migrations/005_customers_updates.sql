-- 003 created the customers table without updated_at and without a default
-- on brand_config. Bring the schema up to the spec for the /api/customers
-- routes (2.8) and /c/:slug lookup (2.9).

ALTER TABLE customers
  ALTER COLUMN brand_config SET DEFAULT '{}'::jsonb;

UPDATE customers SET brand_config = '{}'::jsonb WHERE brand_config IS NULL;

ALTER TABLE customers
  ALTER COLUMN brand_config SET NOT NULL;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
