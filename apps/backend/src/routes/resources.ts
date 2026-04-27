import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/client.js';
import { parseSwaggerDoc } from '../utils/swaggerParser.js';

const router = Router();

// ─── Schemas ──────────────────────────────────────────────────────────────────

const TYPES      = ['REST', 'postgresql', 'agent'] as const;
const AUTH_TYPES = ['none', 'bearer', 'api_key', 'basic'] as const;

const ImportSwaggerSchema = z.object({
  swaggerUrl:   z.string().url('swaggerUrl must be a valid URL'),
  resourceName: z.string().min(1, 'resourceName is required'),
  baseUrl:      z.string().url('baseUrl must be a valid URL'),
  authType:     z.enum(AUTH_TYPES).default('none'),
  secretRef:    z.string().optional(),
});

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

// ─── POST /api/resources/import-swagger ───────────────────────────────────────
// Static path declared before /:id so it doesn't collide with the UUID handler.

router.post('/import-swagger', async (req, res) => {
  const parsed = ImportSwaggerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: parsed.error.flatten(),
    });
  }

  const { swaggerUrl, resourceName, baseUrl, authType, secretRef } = parsed.data;

  // 1. Fetch the swagger document
  let docResponse: Response;
  try {
    docResponse = await fetch(swaggerUrl);
  } catch {
    return res.status(400).json({ error: 'Could not fetch Swagger docs' });
  }
  if (!docResponse.ok) {
    return res.status(400).json({ error: 'Could not fetch Swagger docs' });
  }

  let doc: unknown;
  try {
    doc = await docResponse.json();
  } catch {
    return res.status(400).json({ error: 'Invalid Swagger/OpenAPI format' });
  }

  // 2. Parse — supports both Swagger 2.0 and OpenAPI 3.0
  const endpoints = parseSwaggerDoc(doc);
  if (endpoints.length === 0) {
    return res.status(400).json({ error: 'No endpoints found in docs' });
  }

  // 3. Upsert the resource + replace its endpoints atomically
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Upsert by name — keeping the same id if it already exists
    const { rows: resourceRows } = await client.query<{ id: string; name: string }>(
      `INSERT INTO resources (name, type, base_url, auth_type, secret_ref)
       VALUES ($1, 'REST', $2, $3, $4)
       ON CONFLICT (name) DO UPDATE
         SET base_url   = EXCLUDED.base_url,
             auth_type  = EXCLUDED.auth_type,
             secret_ref = EXCLUDED.secret_ref
       RETURNING id, name`,
      [resourceName, baseUrl, authType, secretRef ?? null],
    );
    const resource = resourceRows[0];

    // Replace existing endpoints
    await client.query('DELETE FROM resource_endpoints WHERE resource_id = $1', [resource.id]);

    // Bulk insert. Build $1,$2,... in groups of 6 to keep param counts predictable.
    const placeholders: string[] = [];
    const values: unknown[] = [];
    endpoints.forEach((ep, i) => {
      const base = i * 6;
      placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}::jsonb, $${base + 6}::jsonb)`);
      values.push(
        resource.id,
        ep.method,
        ep.path,
        ep.summary,
        JSON.stringify(ep.parameters),
        JSON.stringify(ep.requestBody),
      );
    });
    await client.query(
      `INSERT INTO resource_endpoints (resource_id, method, path, summary, parameters, request_body)
       VALUES ${placeholders.join(', ')}`,
      values,
    );

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      resource: { id: resource.id, name: resource.name },
      endpointsImported: endpoints.length,
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('[resources] import-swagger:', err);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// ─── GET /api/resources/:id/endpoints ────────────────────────────────────────
// Also declared before /:id so the more specific route wins.

router.get('/:id/endpoints', async (req, res) => {
  try {
    const { rows } = await pool.query<{
      id:         string;
      method:     string;
      path:       string;
      summary:    string | null;
      parameters: unknown;
    }>(
      `SELECT id, method, path, summary, parameters
       FROM resource_endpoints
       WHERE resource_id = $1
       ORDER BY path ASC, method ASC`,
      [req.params.id],
    );
    return res.json(rows);
  } catch (err) {
    if (pgCode(err) === PG_INVALID_UUID) {
      return res.status(400).json({ error: 'Invalid resource ID' });
    }
    console.error('[resources] endpoints:', err);
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
