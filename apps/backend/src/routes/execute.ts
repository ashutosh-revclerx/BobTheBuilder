import { Router }        from 'express';
import { z }             from 'zod';
import multer            from 'multer';
import { pool }          from '../db/client.js';
import { restExecutor }  from '../executors/restExecutor.js';
import { dbExecutor }    from '../executors/dbExecutor.js';
import { agentExecutor } from '../executors/agentExecutor.js';
import type { ExecutorResult } from '../executors/restExecutor.js';
import { createLogger }  from '../utils/logger.js';

const log = createLogger('execute');
const router = Router();

// 50 MB cap — Excel/CSV/PDF rarely exceed this; protects the server from OOM.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// ─── Schema ───────────────────────────────────────────────────────────────────

const ExecuteSchema = z.object({
  resource:    z.string().min(1, 'resource name is required'),
  endpoint:    z.string().min(1, 'endpoint is required'),
  method:      z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('GET'),
  params:      z.record(z.string(), z.unknown()).optional(),
  body:        z.record(z.string(), z.unknown()).optional(),
  dashboardId: z.string().uuid().optional(), // forwarded to query_logs
  pollUrlTemplate: z.string().optional(),
});

// ─── Secret resolver ─────────────────────────────────────────────────────────

// Converts "{{env.NEXUS_API_KEY}}" → process.env.NEXUS_API_KEY (or null).
// If the value is not in the template format, it is returned as-is so that
// plain literal values (e.g. a raw connection string) still work.
function resolveEnvSecret(secretRef: string | null): string | null {
  if (!secretRef) return null;
  const match = secretRef.match(/^\{\{env\.([A-Z0-9_]+)\}\}$/i);
  if (!match) return secretRef;
  return process.env[match[1]] ?? null;
}

// ─── Fire-and-forget query log ────────────────────────────────────────────────

function logQuery(
  dashboardId: string | undefined,
  resourceName: string,
  endpoint: string,
  status: 'success' | 'error',
  durationMs: number,
): void {
  pool.query(
    `INSERT INTO query_logs (dashboard_id, resource_name, endpoint, status, duration_ms)
     VALUES ($1, $2, $3, $4, $5)`,
    [dashboardId ?? null, resourceName, endpoint, status, durationMs],
  ).catch((err) => log.error('query_log insert failed:', err));
}

// ─── DB row type ──────────────────────────────────────────────────────────────

interface ResourceDbRow {
  id:         string;
  name:       string;
  type:       'REST' | 'postgresql' | 'agent';
  base_url:   string | null;
  auth_type:  string | null;
  secret_ref: string | null;
}

// ─── POST /api/execute ────────────────────────────────────────────────────────

router.post('/', async (req, res) => {
  // 1. Validate request body
  const parsed = ExecuteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error:   'Validation failed',
      details: parsed.error.flatten(),
    });
  }

  const { resource: resourceName, endpoint, method, params, body, dashboardId, pollUrlTemplate } = parsed.data;
  const startMs = Date.now();

  // 2. Look up the resource — this is the one place secret_ref is read from DB
  let resource: ResourceDbRow;
  try {
    const { rows } = await pool.query<ResourceDbRow>(
      `SELECT id, name, type, base_url, auth_type, secret_ref
       FROM resources
       WHERE name = $1`,
      [resourceName],
    );
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error:   `Resource "${resourceName}" not found`,
      });
    }
    resource = rows[0];
  } catch (err) {
    log.error('resource lookup failed:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }

  // 3. Resolve the secret placeholder → real env value (never leaves this process)
  const resolvedSecret = resolveEnvSecret(resource.secret_ref);

  // 4. Dispatch to the correct executor
  let result: ExecutorResult;

  try {
    switch (resource.type) {
      case 'REST': {
        if (!resource.base_url) {
          result = { success: false, error: `Resource "${resourceName}" has no base_url configured` };
          break;
        }
        result = await restExecutor({
          baseUrl:        resource.base_url,
          authType:       resource.auth_type,
          resolvedSecret,
          endpoint,
          method,
          params,
          body,
        });
        break;
      }

      case 'agent': {
        if (!resource.base_url) {
          result = { success: false, error: `Resource "${resourceName}" has no base_url configured` };
          break;
        }
        result = await agentExecutor({
          baseUrl:        resource.base_url,
          authType:       resource.auth_type,
          resolvedSecret,
          endpoint,
          params,
          body,
          pollUrlTemplate,
        });
        break;
      }

      case 'postgresql': {
        // For DB resources the endpoint IS the SQL query.
        // params are positional SQL params: { "1": "val1", "2": "val2" } → ["val1", "val2"]
        const sqlParams = params
          ? Object.keys(params)
              .sort((a, b) => Number(a) - Number(b))
              .map((k) => params[k])
          : [];

        result = await dbExecutor({
          connectionString: resolvedSecret ?? '',
          query:            endpoint,
          params:           sqlParams,
        });
        break;
      }

      default: {
        result = { success: false, error: `Unsupported resource type: ${resource.type}` };
      }
    }
  } catch (err) {
    result = { success: false, error: (err as Error).message };
  }

  // 5. Log to query_logs — fire and forget, never block the response
  logQuery(
    dashboardId,
    resourceName,
    endpoint,
    result.success ? 'success' : 'error',
    Date.now() - startMs,
  );

  // 6. Return
  return res.json(result);
});

// ─── POST /api/execute/upload ─────────────────────────────────────────────────
// Multipart proxy for FileUpload component. Accepts files in `file` field and
// forwards them to a registered REST resource as multipart/form-data.
//
// Headers:
//   x-btb-resource-id   - UUID of the resource to upload to
//   x-btb-endpoint-path - endpoint path on that resource (e.g. /upload)
//   x-btb-field-name    - optional override for the form field name (default: "file")

router.post('/upload', upload.any(), async (req, res) => {
  const resourceId   = String(req.headers['x-btb-resource-id']   || '').trim();
  const endpointPath = String(req.headers['x-btb-endpoint-path'] || '').trim();
  const fieldName    = String(req.headers['x-btb-field-name']    || 'file').trim();

  if (!resourceId || !endpointPath) {
    return res.status(400).json({
      success: false,
      error: 'Missing x-btb-resource-id or x-btb-endpoint-path header',
    });
  }

  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) {
    return res.status(400).json({ success: false, error: 'No files in request' });
  }

  let resource: ResourceDbRow;
  try {
    const { rows } = await pool.query<ResourceDbRow>(
      `SELECT id, name, type, base_url, auth_type, secret_ref
       FROM resources
       WHERE id = $1`,
      [resourceId],
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Resource not found' });
    }
    resource = rows[0];
  } catch (err) {
    log.error('upload resource lookup failed:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }

  if (resource.type !== 'REST' || !resource.base_url) {
    return res.status(400).json({
      success: false,
      error: 'Upload is only supported for REST resources with a base_url',
    });
  }

  const resolvedSecret = resolveEnvSecret(resource.secret_ref);

  // Build a FormData on the server (Node 18+ has these globals).
  const fd = new FormData();
  for (const f of files) {
    // Copy into a fresh Uint8Array to avoid the SharedArrayBuffer typing edge.
    const view = new Uint8Array(f.buffer);
    const blob = new Blob([view], { type: f.mimetype || 'application/octet-stream' });
    fd.append(f.fieldname || fieldName, blob, f.originalname);
  }
  // Forward any non-file body fields too (e.g. dataset name typed alongside).
  for (const [k, v] of Object.entries(req.body || {})) {
    if (typeof v === 'string') fd.append(k, v);
  }

  const headers: Record<string, string> = {};
  if (resource.auth_type === 'bearer' && resolvedSecret) {
    headers.Authorization = `Bearer ${resolvedSecret}`;
  } else if (resource.auth_type === 'api_key' && resolvedSecret) {
    headers['X-API-Key'] = resolvedSecret;
  } else if (resource.auth_type === 'basic' && resolvedSecret) {
    headers.Authorization = `Basic ${Buffer.from(resolvedSecret).toString('base64')}`;
  }

  const url = resource.base_url.replace(/\/$/, '') + (endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`);
  const startMs = Date.now();

  try {
    const upstream = await fetch(url, { method: 'POST', headers, body: fd as any });
    const text = await upstream.text();
    let payload: unknown = text;
    try { payload = JSON.parse(text); } catch { /* leave as text */ }

    logQuery(undefined, resource.name, endpointPath, upstream.ok ? 'success' : 'error', Date.now() - startMs);

    if (!upstream.ok) {
      return res.status(upstream.status).json({ success: false, error: payload });
    }
    return res.json({ success: true, data: payload });
  } catch (err) {
    log.error('upload proxy failed:', err);
    logQuery(undefined, resource.name, endpointPath, 'error', Date.now() - startMs);
    return res.status(502).json({ success: false, error: (err as Error).message });
  }
});

export default router;
