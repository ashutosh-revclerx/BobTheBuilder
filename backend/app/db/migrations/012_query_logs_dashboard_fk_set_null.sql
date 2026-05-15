-- Allow dashboards to be deleted even when query_logs reference them.
-- Original FK had no ON DELETE action (defaults to NO ACTION), which blocked
-- deletion of any dashboard that had ever executed a query. Audit rows are
-- preserved with a NULL dashboard_id.

DO $$
DECLARE
  fk_name TEXT;
BEGIN
  SELECT conname INTO fk_name
  FROM pg_constraint
  WHERE conrelid = 'query_logs'::regclass
    AND contype = 'f'
    AND conkey = (SELECT array_agg(attnum)
                  FROM pg_attribute
                  WHERE attrelid = 'query_logs'::regclass
                    AND attname = 'dashboard_id');

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE query_logs DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

ALTER TABLE query_logs
  ADD CONSTRAINT query_logs_dashboard_id_fkey
  FOREIGN KEY (dashboard_id)
  REFERENCES dashboards(id)
  ON DELETE SET NULL;
