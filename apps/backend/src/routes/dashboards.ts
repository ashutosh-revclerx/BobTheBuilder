import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/client.js';

const router = Router();

const LLM_SERVICE_URL = process.env.LLM_SERVICE_URL ?? 'http://localhost:8000';
const DEFAULT_LLM_TIMEOUT_MS = 180_000;

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const LLM_TIMEOUT_MS = readPositiveIntEnv('LLM_TIMEOUT_MS', DEFAULT_LLM_TIMEOUT_MS);

const GenerateSchema = z.object({
  prompt:        z.string().min(3),
  resourceIds:   z.array(z.string().uuid()).default([]),
  docsUrls:      z.array(z.string()).default([]),
  variantCount:  z.number().int().min(1).max(8).default(4),
});

// ─── Schemas ──────────────────────────────────────────────────────────────────

const ConfigSchema = z
  .object({
    components: z.array(z.any()),
    queries: z.array(z.any()),
  })
  .passthrough();

const CreateSchema = z.object({
  name:   z.string().min(1, 'name is required'),
  slug:   z.string().optional(),
  config: ConfigSchema,
  status: z.enum(['draft', 'live']).default('draft'),
});

const UpdateSchema = z.object({
  name:   z.string().min(1).optional(),
  slug:   z.string().optional(),
  config: ConfigSchema.optional(),
  status: z.enum(['draft', 'live']).optional(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

const PG_UNIQUE_VIOLATION    = '23505'; // duplicate key
const PG_INVALID_UUID        = '22P02'; // invalid UUID text representation

function pgCode(err: unknown): string | undefined {
  return (err as any)?.code;
}

// ─── POST /api/dashboards ─────────────────────────────────────────────────────

router.post('/', async (req, res) => {
  const parsed = CreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: parsed.error.flatten(),
    });
  }

  const { name, config, status } = parsed.data;
  let slug = parsed.data.slug ?? toSlug(name);
  let attempts = 0;

  while (attempts < 10) {
    try {
      const { rows } = await pool.query<DashboardRow>(
        `INSERT INTO dashboards (name, slug, config, status)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, slug, config, status, created_at, updated_at`,
        [name, slug, config, status],
      );
      return res.status(201).json(rows[0]);
    } catch (err) {
      if (pgCode(err) === PG_UNIQUE_VIOLATION) {
        attempts++;
        slug = `${parsed.data.slug ?? toSlug(name)}-${attempts}`;
        continue;
      }
      console.error('[dashboards] create:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(409).json({ error: 'Could not generate a unique slug after 10 attempts' });
});

// ─── GET /api/dashboards ──────────────────────────────────────────────────────

router.get('/', async (_req, res) => {
  try {
    // Pull assigned customers from BOTH sources:
    //   1. The new many-to-many `dashboard_assignments` table (post-migration)
    //   2. The legacy 1-to-1 `customers.dashboard_id` column (pre-migration data)
    // Without the legacy union, customers created before the many-to-many work
    // appear as "No customer assigned" on the dashboard cards.
    const { rows } = await pool.query<any>(
      `SELECT
         d.id, d.name, d.slug, d.status, d.created_at, d.updated_at,
         COALESCE(
           (
             SELECT jsonb_agg(jsonb_build_object('id', sub.id, 'name', sub.name, 'slug', sub.slug))
             FROM (
               SELECT c.id, c.name, c.slug
               FROM customers c
               JOIN dashboard_assignments da
                 ON da.customer_id = c.id AND da.dashboard_id = d.id
               UNION
               SELECT c.id, c.name, c.slug
               FROM customers c
               WHERE c.dashboard_id = d.id
             ) sub
           ),
           '[]'::jsonb
         ) AS assigned_customers
       FROM dashboards d
       ORDER BY d.updated_at DESC, d.created_at DESC`,
    );
    return res.json(rows);
  } catch (err) {
    console.error('[dashboards] list:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/dashboards/generate ────────────────────────────────────────────
// Proxy to the Python LLM microservice. Loads the requested resources +
// their imported endpoints, packs the LLM payload, and forwards. Does NOT
// save anything to the dashboards table — caller (template-picker UI)
// decides which variant to persist.

router.post('/generate', async (req, res) => {
  const parsed = GenerateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error:   'Validation failed',
      details: parsed.error.flatten(),
    });
  }
  const { prompt, resourceIds, docsUrls, variantCount } = parsed.data;

  // Hydrate the resource IDs into the shape the LLM service expects.
  let resourcesPayload: Array<{
    id:        string;
    name:      string;
    type:      string;
    base_url:  string | null;
    endpoints: Array<{ method: string; path: string; summary: string | null }>;
  }> = [];

  if (resourceIds.length > 0) {
    try {
      const { rows } = await pool.query<{
        id:        string;
        name:      string;
        type:      string;
        base_url:  string | null;
        endpoints: Array<{ method: string; path: string; summary: string | null }> | null;
      }>(
        `SELECT
           r.id, r.name, r.type, r.base_url,
           COALESCE(
             jsonb_agg(
               jsonb_build_object('method', e.method, 'path', e.path, 'summary', e.summary)
               ORDER BY e.path, e.method
             ) FILTER (WHERE e.id IS NOT NULL),
             '[]'::jsonb
           ) AS endpoints
         FROM resources r
         LEFT JOIN resource_endpoints e ON e.resource_id = r.id
         WHERE r.id = ANY($1::uuid[])
         GROUP BY r.id`,
        [resourceIds],
      );
      resourcesPayload = rows.map((r) => ({
        id:        r.id,
        name:      r.name,
        type:      r.type,
        base_url:  r.base_url,
        endpoints: r.endpoints ?? [],
      }));
    } catch (err) {
      console.error('[dashboards] generate resource lookup:', err);
      return res.status(500).json({ error: 'Could not load resources for the LLM' });
    }
  }

  // Forward to the Python service with a hard timeout so a stuck Gemini
  // call doesn't hang the dashboard backend.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  try {
    const response = await fetch(`${LLM_SERVICE_URL}/generate`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        prompt,
        resources:    resourcesPayload,
        docsUrls,
        variantCount,
      }),
      signal: controller.signal,
    });

    const text = await response.text();
    let json: unknown = null;
    try { json = JSON.parse(text); } catch { /* keep raw text for error path */ }

    if (!response.ok) {
      const detail = (json && typeof json === 'object' && 'detail' in json)
        ? String((json as Record<string, unknown>).detail)
        : text || `LLM service returned ${response.status}`;
      return res.status(502).json({ error: detail });
    }

    return res.json(json);
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      const seconds = Math.round(LLM_TIMEOUT_MS / 1000);
      return res.status(504).json({ error: `LLM service took longer than ${seconds} seconds` });
    }
    console.error('[dashboards] generate proxy error:', err);
    return res.status(502).json({ error: 'Could not reach the LLM service' });
  } finally {
    clearTimeout(timer);
  }
});

// ─── GET /api/dashboards/:id ──────────────────────────────────────────────────

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query<DashboardRow>(
      `SELECT id, name, slug, config, status, created_at, updated_at
       FROM dashboards
       WHERE id = $1`,
      [req.params.id],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Dashboard not found' });
    }
    return res.json(rows[0]);
  } catch (err) {
    if (pgCode(err) === PG_INVALID_UUID) {
      return res.status(400).json({ error: 'Invalid dashboard ID' });
    }
    console.error('[dashboards] get:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PUT /api/dashboards/:id ──────────────────────────────────────────────────

router.put('/:id', async (req, res) => {
  const parsed = UpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: parsed.error.flatten(),
    });
  }

  const data = parsed.data;

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'No fields provided to update' });
  }

  // Build dynamic SET clause from whichever fields were supplied.
  // Slug is derived from the incoming name when name changes but slug is omitted.
  const setClauses: string[] = [];
  const values: unknown[]    = [];
  let   i = 1;

  if (data.name !== undefined) {
    setClauses.push(`name = $${i++}`);
    values.push(data.name);
  }

  const newSlug = data.slug ?? (data.name !== undefined ? toSlug(data.name) : undefined);
  if (newSlug !== undefined) {
    setClauses.push(`slug = $${i++}`);
    values.push(newSlug);
  }

  if (data.config !== undefined) {
    setClauses.push(`config = $${i++}`);
    values.push(data.config);
  }

  if (data.status !== undefined) {
    setClauses.push(`status = $${i++}`);
    values.push(data.status);
  }

  setClauses.push('updated_at = NOW()');
  values.push(req.params.id);

  try {
    const { rows } = await pool.query<DashboardRow>(
      `UPDATE dashboards
       SET ${setClauses.join(', ')}
       WHERE id = $${i}
       RETURNING id, name, slug, config, status, created_at, updated_at`,
      values,
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Dashboard not found' });
    }
    return res.json(rows[0]);
  } catch (err) {
    if (pgCode(err) === PG_UNIQUE_VIOLATION) {
      return res.status(409).json({ error: 'Slug is already taken' });
    }
    if (pgCode(err) === PG_INVALID_UUID) {
      return res.status(400).json({ error: 'Invalid dashboard ID' });
    }
    console.error('[dashboards] update:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PATCH /api/dashboards/:id/publish ────────────────────────────────────────

router.patch('/:id/publish', async (req, res) => {
  const schema = z.object({
    status: z.enum(['draft', 'live']),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const { status } = parsed.data;
  const publishedAt = status === 'live' ? 'NOW()' : 'NULL';

  try {
    const { rows } = await pool.query<DashboardRow>(
      `UPDATE dashboards
       SET status = $1, published_at = ${publishedAt}, updated_at = NOW()
       WHERE id = $2
       RETURNING id, name, slug, config, status, published_at, created_at, updated_at`,
      [status, req.params.id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Dashboard not found' });
    }

    return res.json(rows[0]);
  } catch (err) {
    if (pgCode(err) === PG_INVALID_UUID) {
      return res.status(400).json({ error: 'Invalid dashboard ID' });
    }
    console.error('[dashboards] publish:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/dashboards/:id/assign ──────────────────────────────────────────

router.post('/:id/assign', async (req, res) => {
  const schema = z.object({
    customer_ids: z.array(z.string().uuid()),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: parsed.error.flatten(),
    });
  }

  const { customer_ids } = parsed.data;
  const dashboardId = req.params.id;

  try {
    // 1. Validate dashboard exists
    const { rows: dashRows } = await pool.query('SELECT id FROM dashboards WHERE id = $1', [dashboardId]);
    if (dashRows.length === 0) {
      return res.status(404).json({ error: 'Dashboard not found' });
    }

    // 2. Sync assignments (delete existing, then insert new)
    await pool.query('BEGIN');
    try {
      await pool.query('DELETE FROM dashboard_assignments WHERE dashboard_id = $1', [dashboardId]);
      
      if (customer_ids.length > 0) {
        // Use a single query for multiple inserts if possible, or loop for simplicity
        for (const cid of customer_ids) {
          await pool.query(
            `INSERT INTO dashboard_assignments (dashboard_id, customer_id)
             VALUES ($1, $2)`,
            [dashboardId, cid]
          );
        }
      }
      await pool.query('COMMIT');
    } catch (e) {
      await pool.query('ROLLBACK');
      throw e;
    }

    // 3. Return updated list of assigned customers
    const { rows: assignedCustomers } = await pool.query(
      `SELECT c.id, c.name, c.slug
       FROM customers c
       JOIN dashboard_assignments da ON da.customer_id = c.id
       WHERE da.dashboard_id = $1
       ORDER BY c.name ASC`,
      [dashboardId]
    );

    return res.json(assignedCustomers);
  } catch (err) {
    if (pgCode(err) === PG_INVALID_UUID) {
      return res.status(400).json({ error: 'Invalid ID' });
    }
    console.error('[dashboards] assign:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/dashboards/:id/customers ────────────────────────────────────────

router.get('/:id/customers', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.id, c.name, c.slug
       FROM customers c
       JOIN dashboard_assignments da ON da.customer_id = c.id
       WHERE da.dashboard_id = $1
       ORDER BY c.name ASC`,
      [req.params.id]
    );
    return res.json(rows);
  } catch (err) {
    if (pgCode(err) === PG_INVALID_UUID) {
      return res.status(400).json({ error: 'Invalid dashboard ID' });
    }
    console.error('[dashboards] get assigned customers:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/dashboards/:id ───────────────────────────────────────────────

router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM dashboards WHERE id = $1',
      [req.params.id],
    );
    if (!result.rowCount) {
      return res.status(404).json({ error: 'Dashboard not found' });
    }
    return res.status(204).send();
  } catch (err) {
    if (pgCode(err) === PG_INVALID_UUID) {
      return res.status(400).json({ error: 'Invalid dashboard ID' });
    }
    if (pgCode(err) === '23503') {
      return res.status(409).json({ error: 'Dashboard is still referenced — unassign any customers first' });
    }
    console.error('[dashboards] delete:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Row types (for pg generic typing) ───────────────────────────────────────

interface DashboardRow {
  id:           string;
  name:         string;
  slug:         string;
  config:       unknown;
  status:       string;
  published_at: Date | null;
  created_at:   Date;
  updated_at:   Date;
}

interface DashboardSummaryRow {
  id:         string;
  name:       string;
  slug:       string;
  status:     string;
  created_at: Date;
  updated_at: Date;
}

export default router;
