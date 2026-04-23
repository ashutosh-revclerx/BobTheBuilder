CREATE TABLE IF NOT EXISTS customers (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL,
  slug         TEXT        UNIQUE NOT NULL,
  dashboard_id UUID        REFERENCES dashboards(id),
  brand_config JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
