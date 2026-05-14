-- Add access_token column to customers table for URL-based dashboard access
-- access_token is NULL by default (opt-in security, backwards compatible)
-- When set, customers./:slug/dashboard endpoints require token validation

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS access_token TEXT DEFAULT NULL;

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_customers_access_token ON customers(access_token) WHERE access_token IS NOT NULL;
