CREATE TABLE IF NOT EXISTS resources (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        UNIQUE NOT NULL,
  type       TEXT        NOT NULL,
  base_url   TEXT,
  auth_type  TEXT,
  secret_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
