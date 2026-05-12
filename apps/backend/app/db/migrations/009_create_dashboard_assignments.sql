CREATE TABLE IF NOT EXISTS dashboard_assignments (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id UUID        NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  customer_id  UUID        NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  assigned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(dashboard_id, customer_id)
);
