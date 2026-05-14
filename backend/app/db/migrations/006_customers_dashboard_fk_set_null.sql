-- Original 003 created customers.dashboard_id with a plain FK that defaults to
-- NO ACTION, so deleting a referenced dashboard throws. Change it to
-- ON DELETE SET NULL — deleting a dashboard un-assigns it from any customer
-- instead of blocking the delete.

ALTER TABLE customers
  DROP CONSTRAINT IF EXISTS customers_dashboard_id_fkey;

ALTER TABLE customers
  ADD CONSTRAINT customers_dashboard_id_fkey
  FOREIGN KEY (dashboard_id)
  REFERENCES dashboards(id)
  ON DELETE SET NULL;
