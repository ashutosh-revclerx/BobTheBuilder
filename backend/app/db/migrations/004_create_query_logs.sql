CREATE TABLE IF NOT EXISTS query_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id  UUID        REFERENCES dashboards(id),
  resource_name TEXT,
  endpoint      TEXT,
  status        TEXT,
  duration_ms   INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
