import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/client.js';

const router = Router();

// ─── Schemas ──────────────────────────────────────────────────────────────────

const TYPES      = ['REST', 'postgresql', 'agent'] as const;
const AUTH_TYPES = ['none', 'bearer', 'api_key', 'basic'] as const;

const CreateSchema = z
  .object({
    name:       z.string().min(1, 'name is required'),
    type:       z.enum(TYPES),
    base_url:   z.string().url('base_url must be a valid URL').optional(),
    auth_type:  z.enum(AUTH_TYPES).default('none'),
    secret_ref: z.string().optional(),
  })
  .refine(
    (d) => !(d.type === 'REST' || d.type === 'agent') || !!d.base_url,
    { message: 'base_url is required for REST and agent resource types', path: ['base_url'] },
  );

const UpdateSchema = z
  .object({
    name:       z.string().min(1).optional(),
    type:       z.enum(TYPES).optional(),
    base_url:   z.string().url('base_url must be a valid URL').optional(),
    auth_type:  z.enum(AUTH_TYPES).optional(),
    secret_ref: z.string().optional(),
  })
  .refine(
    // Only reject when type is explicitly changed to REST/agent AND base_url is
    // explicitly cleared at the same time. If base_url is not in the payload we
    // assume the stored value is still valid.
    (d) => !(
      (d.type === 'REST' || d.type === 'agent') &&
      d.base_url !== undefined &&
      !d.base_url
    ),
    { message: 'base_url cannot be empty for REST/agent types', path: ['base_url'] },
  );

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PG_UNIQUE_VIOLATION = '23505';
const PG_INVALID_UUID     = '22P02';

function pgCode(err: unknown): string | undefined {
  return (err as any)?.code;
}

// Columns we always SELECT — secret_ref is deliberately excluded.
// has_secret lets callers know whether a secret placeholder is configured
// without revealing which env var name is used.
const SAFE_COLS = `
  id,
  name,
  type,
  base_url,
  auth_type,
  (secret_ref IS NOT NULL) AS has_secret,
  created_at
`.trim();

// ─── POST /api/resources ─────────────────────────────────────────────────────

router.post('/', async (req, res) => {
  const parsed = CreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: parsed.error.flatten(),
    });
  }

  const { name, type, base_url, auth_type, secret_ref } = parsed.data;

  try {
    const { rows } = await pool.query<ResourceRow>(
      `INSERT INTO resources (name, type, base_url, auth_type, secret_ref)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${SAFE_COLS}`,
      [name, type, base_url ?? null, auth_type, secret_ref ?? null],
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    if (pgCode(err) === PG_UNIQUE_VIOLATION) {
      return res.status(409).json({ error: `Resource name "${name}" is already taken` });
    }
    console.error('[resources] create:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/resources ───────────────────────────────────────────────────────

router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query<ResourceRow>(
      `SELECT ${SAFE_COLS} FROM resources ORDER BY name ASC`,
    );
    return res.json(rows);
  } catch (err) {
    console.error('[resources] list:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/resources/:id ───────────────────────────────────────────────────

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query<ResourceRow>(
      `SELECT ${SAFE_COLS} FROM resources WHERE id = $1`,
      [req.params.id],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    return res.json(rows[0]);
  } catch (err) {
    if (pgCode(err) === PG_INVALID_UUID) {
      return res.status(400).json({ error: 'Invalid resource ID' });
    }
    console.error('[resources] get:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PUT /api/resources/:id ───────────────────────────────────────────────────

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

  const setClauses: string[] = [];
  const values: unknown[]    = [];
  let   i = 1;

  if (data.name       !== undefined) { setClauses.push(`name       = $${i++}`); values.push(data.name); }
  if (data.type       !== undefined) { setClauses.push(`type       = $${i++}`); values.push(data.type); }
  if (data.base_url   !== undefined) { setClauses.push(`base_url   = $${i++}`); values.push(data.base_url); }
  if (data.auth_type  !== undefined) { setClauses.push(`auth_type  = $${i++}`); values.push(data.auth_type); }
  if (data.secret_ref !== undefined) { setClauses.push(`secret_ref = $${i++}`); values.push(data.secret_ref); }

  values.push(req.params.id);

  try {
    const { rows } = await pool.query<ResourceRow>(
      `UPDATE resources
       SET ${setClauses.join(', ')}
       WHERE id = $${i}
       RETURNING ${SAFE_COLS}`,
      values,
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    return res.json(rows[0]);
  } catch (err) {
    if (pgCode(err) === PG_UNIQUE_VIOLATION) {
      return res.status(409).json({ error: 'Resource name is already taken' });
    }
    if (pgCode(err) === PG_INVALID_UUID) {
      return res.status(400).json({ error: 'Invalid resource ID' });
    }
    console.error('[resources] update:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/resources/:id ────────────────────────────────────────────────

router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM resources WHERE id = $1',
      [req.params.id],
    );
    if (!result.rowCount) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    return res.status(204).send();
  } catch (err) {
    if (pgCode(err) === PG_INVALID_UUID) {
      return res.status(400).json({ error: 'Invalid resource ID' });
    }
    console.error('[resources] delete:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Row type ─────────────────────────────────────────────────────────────────

interface ResourceRow {
  id:         string;
  name:       string;
  type:       string;
  base_url:   string | null;
  auth_type:  string | null;
  has_secret: boolean;
  created_at: Date;
}

export default router;
