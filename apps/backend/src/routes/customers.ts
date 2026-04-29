import { Router } from 'express';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { pool } from '../db/client.js';

const router = Router();

// ─── Schemas ──────────────────────────────────────────────────────────────────

// lowercase letters, digits, hyphens; no leading/trailing hyphen; no empties
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const CreateSchema = z.object({
  name:         z.string().min(1, 'name is required'),
  slug:         z.string().regex(SLUG_RE, 'slug must be lowercase letters, numbers, and hyphens only'),
  dashboard_id: z.string().uuid('dashboard_id must be a valid UUID').optional().nullable(),
  brand_config: z.record(z.string(), z.unknown()).optional(),
});

const UpdateSchema = z.object({
  name:         z.string().min(1).optional(),
  slug:         z.string().regex(SLUG_RE, 'slug must be lowercase letters, numbers, and hyphens only').optional(),
  dashboard_id: z.string().uuid('dashboard_id must be a valid UUID').optional().nullable(),
  brand_config: z.record(z.string(), z.unknown()).optional(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PG_UNIQUE_VIOLATION = '23505';
const PG_INVALID_UUID     = '22P02';
const PG_FOREIGN_KEY      = '23503';

function pgCode(err: unknown): string | undefined {
  return (err as any)?.code;
}

function generateAccessToken(): string {
  return randomBytes(16).toString('hex');
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface CustomerRow {
  id:           string;
  name:         string;
  slug:         string;
  dashboard_id: string | null;
  brand_config: Record<string, unknown>;
  access_token: string | null;
  created_at:   Date;
  updated_at:   string;
}

interface CustomerSummaryRow {
  id:           string;
  name:         string;
  slug:         string;
  dashboard_id: string | null;
  access_token: string | null;
  created_at:   Date;
}

// ─── POST /api/customers ──────────────────────────────────────────────────────

router.post('/', async (req, res) => {
  const parsed = CreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error:   'Validation failed',
      details: parsed.error.flatten(),
    });
  }

  const { name, slug, dashboard_id, brand_config } = parsed.data;
  const accessToken = generateAccessToken();

  try {
    const { rows } = await pool.query<CustomerRow>(
      `INSERT INTO customers (name, slug, dashboard_id, brand_config, access_token)
       VALUES ($1, $2, $3, $4::jsonb, $5)
       RETURNING id, name, slug, dashboard_id, brand_config, access_token, created_at, updated_at`,
      [name, slug, dashboard_id ?? null, JSON.stringify(brand_config ?? {}), accessToken],
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    if (pgCode(err) === PG_UNIQUE_VIOLATION) {
      return res.status(409).json({ error: `Slug "${slug}" is already taken` });
    }
    if (pgCode(err) === PG_FOREIGN_KEY) {
      return res.status(400).json({ error: 'dashboard_id does not reference an existing dashboard' });
    }
    console.error('[customers] create:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/customers ───────────────────────────────────────────────────────

router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query<CustomerSummaryRow>(
      `SELECT id, name, slug, dashboard_id, access_token, created_at
       FROM customers
       ORDER BY created_at DESC`,
    );
    return res.json(rows);
  } catch (err) {
    console.error('[customers] list:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/customers/:slug/dashboard ──────────────────────────────────────
// NOTE: Must be declared *before* `/:id` so the slug route wins.
// If customer.access_token is set, the request must supply it via
// ?token=xyz  OR  x-dashboard-token header. Null token = open access.

router.get('/:slug/dashboard', async (req, res) => {
  try {
    const { rows: customerRows } = await pool.query<{
      id:           string;
      access_token: string | null;
    }>(
      `SELECT id, access_token FROM customers WHERE slug = $1`,
      [req.params.slug],
    );

    if (customerRows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const customer = customerRows[0];

    // Token validation: if customer has access_token set, require it
    if (customer.access_token !== null) {
      const providedToken =
        (req.query.token as string | undefined) ||
        (req.get('x-dashboard-token') as string | undefined);
      if (!providedToken || providedToken !== customer.access_token) {
        return res.status(401).json({ error: 'Invalid access token' });
      }
    }

    const { rows } = await pool.query<{
      customer_id:      string;
      customer_name:    string;
      customer_slug:    string;
      brand_config:     Record<string, unknown>;
      dashboard_id:     string | null;
      dashboard_name:   string | null;
      dashboard_slug:   string | null;
      dashboard_cfg:    unknown;
      dashboard_status: string | null;
    }>(
      `SELECT
         c.id          AS customer_id,
         c.name        AS customer_name,
         c.slug        AS customer_slug,
         c.brand_config,
         d.id          AS dashboard_id,
         d.name        AS dashboard_name,
         d.slug        AS dashboard_slug,
         d.config      AS dashboard_cfg,
         d.status      AS dashboard_status
       FROM customers c
       LEFT JOIN LATERAL (
         SELECT d.id, d.name, d.slug, d.config, d.status
         FROM dashboards d
         WHERE (d.id = c.dashboard_id OR d.id IN (
           SELECT dashboard_id FROM dashboard_assignments WHERE customer_id = c.id
         ))
         AND d.status = 'live'
         ORDER BY (d.id = c.dashboard_id) DESC, d.published_at DESC
         LIMIT 1
       ) d ON TRUE
       WHERE c.id = $1`,
      [customer.id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const row = rows[0];

    if (!row.dashboard_id || row.dashboard_status !== 'live') {
      return res.status(404).json({ error: 'No live dashboard assigned to this customer' });
    }

    return res.json({
      customer: {
        id:           row.customer_id,
        name:         row.customer_name,
        slug:         row.customer_slug,
        brand_config: row.brand_config,
      },
      dashboard: {
        id:     row.dashboard_id,
        name:   row.dashboard_name,
        slug:   row.dashboard_slug,
        config: row.dashboard_cfg,
      },
    });
  } catch (err) {
    console.error('[customers] slug→dashboard:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/customers/:id ───────────────────────────────────────────────────

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query<CustomerRow>(
      `SELECT id, name, slug, dashboard_id, brand_config, access_token, created_at, updated_at
       FROM customers
       WHERE id = $1`,
      [req.params.id],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    return res.json(rows[0]);
  } catch (err) {
    if (pgCode(err) === PG_INVALID_UUID) {
      return res.status(400).json({ error: 'Invalid customer ID' });
    }
    console.error('[customers] get:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PUT /api/customers/:id ───────────────────────────────────────────────────

router.put('/:id', async (req, res) => {
  const parsed = UpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error:   'Validation failed',
      details: parsed.error.flatten(),
    });
  }

  const data = parsed.data;
  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'No fields provided to update' });
  }

  const setClauses: string[] = [];
  const values: unknown[]    = [];
  let   i = 1;

  if (data.name         !== undefined) { setClauses.push(`name         = $${i++}`); values.push(data.name); }
  if (data.slug         !== undefined) { setClauses.push(`slug         = $${i++}`); values.push(data.slug); }
  if (data.dashboard_id !== undefined) { setClauses.push(`dashboard_id = $${i++}`); values.push(data.dashboard_id); }
  if (data.brand_config !== undefined) { setClauses.push(`brand_config = $${i++}::jsonb`); values.push(JSON.stringify(data.brand_config)); }

  setClauses.push('updated_at = NOW()');
  values.push(req.params.id);

  try {
    const { rows } = await pool.query<CustomerRow>(
      `UPDATE customers
       SET ${setClauses.join(', ')}
       WHERE id = $${i}
       RETURNING id, name, slug, dashboard_id, brand_config, access_token, created_at, updated_at`,
      values,
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    return res.json(rows[0]);
  } catch (err) {
    if (pgCode(err) === PG_UNIQUE_VIOLATION) {
      return res.status(409).json({ error: 'Slug is already taken' });
    }
    if (pgCode(err) === PG_FOREIGN_KEY) {
      return res.status(400).json({ error: 'dashboard_id does not reference an existing dashboard' });
    }
    if (pgCode(err) === PG_INVALID_UUID) {
      return res.status(400).json({ error: 'Invalid customer ID' });
    }
    console.error('[customers] update:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/customers/:id ────────────────────────────────────────────────

router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM customers WHERE id = $1',
      [req.params.id],
    );
    if (!result.rowCount) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    return res.status(204).send();
  } catch (err) {
    if (pgCode(err) === PG_INVALID_UUID) {
      return res.status(400).json({ error: 'Invalid customer ID' });
    }
    console.error('[customers] delete:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/customers/:id/dashboards ───────────────────────────────────────

router.get('/:id/dashboards', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT d.id, d.name, d.slug, d.status, d.published_at
       FROM dashboards d
       JOIN dashboard_assignments da ON da.dashboard_id = d.id
       WHERE da.customer_id = $1 AND d.status = 'live'
       ORDER BY d.published_at DESC`,
      [req.params.id],
    );
    return res.json(rows);
  } catch (err) {
    if (pgCode(err) === PG_INVALID_UUID) {
      return res.status(400).json({ error: 'Invalid customer ID' });
    }
    console.error('[customers] list dashboards:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/customers/:id/rotate-token ────────────────────────────────────
// Generate a new access token and replace the old one.

router.post('/:id/rotate-token', async (req, res) => {
  try {
    const newToken = generateAccessToken();
    const { rows } = await pool.query<CustomerRow>(
      `UPDATE customers
       SET access_token = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, name, slug, dashboard_id, brand_config, access_token, created_at, updated_at`,
      [newToken, req.params.id],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    return res.json(rows[0]);
  } catch (err) {
    if (pgCode(err) === PG_INVALID_UUID) {
      return res.status(400).json({ error: 'Invalid customer ID' });
    }
    console.error('[customers] rotate-token:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/customers/:id/clear-token ─────────────────────────────────────
// Disable token requirement by setting access_token to NULL (backwards compatible).

router.post('/:id/clear-token', async (req, res) => {
  try {
    const { rows } = await pool.query<CustomerRow>(
      `UPDATE customers
       SET access_token = NULL, updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, slug, dashboard_id, brand_config, access_token, created_at, updated_at`,
      [req.params.id],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    return res.json(rows[0]);
  } catch (err) {
    if (pgCode(err) === PG_INVALID_UUID) {
      return res.status(400).json({ error: 'Invalid customer ID' });
    }
    console.error('[customers] clear-token:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
