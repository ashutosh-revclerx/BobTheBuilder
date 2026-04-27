CREATE TABLE IF NOT EXISTS resource_endpoints (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id   UUID        NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  method        TEXT        NOT NULL,
  path          TEXT        NOT NULL,
  summary       TEXT,
  parameters    JSONB       NOT NULL DEFAULT '[]'::jsonb,
  request_body  JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (resource_id, method, path)
);

CREATE INDEX IF NOT EXISTS idx_resource_endpoints_resource
  ON resource_endpoints(resource_id);
