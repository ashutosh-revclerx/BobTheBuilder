import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/client.js';

const router = Router();

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
  const slug = parsed.data.slug ?? toSlug(name);

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
      return res.status(409).json({ error: `Slug "${slug}" is already taken` });
    }
    console.error('[dashboards] create:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/dashboards ──────────────────────────────────────────────────────

router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query<DashboardSummaryRow>(
      `SELECT id, name, slug, status, created_at, updated_at
       FROM dashboards
       ORDER BY updated_at DESC, created_at DESC`,
    );
    return res.json(rows);
  } catch (err) {
    console.error('[dashboards] list:', err);
    return res.status(500).json({ error: 'Internal server error' });
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
  id:         string;
  name:       string;
  slug:       string;
  config:     unknown;
  status:     string;
  created_at: Date;
  updated_at: Date;
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
