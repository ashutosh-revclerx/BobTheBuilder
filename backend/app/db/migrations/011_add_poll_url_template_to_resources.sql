-- 011 — Add poll_url_template column to resources.
--
-- Agent-type resources kick off async jobs and then need to be polled for
-- completion. Each agent API has a slightly different polling URL convention
-- (some return poll_url in the kickoff response, others use a template like
-- /public/result/{jobId}). Storing the template once per resource lets the
-- frontend stop having to embed it in every query.
--
-- The execute route falls back to this stored value when the query payload
-- doesn't provide its own pollUrlTemplate.

ALTER TABLE resources
  ADD COLUMN IF NOT EXISTS poll_url_template TEXT;
