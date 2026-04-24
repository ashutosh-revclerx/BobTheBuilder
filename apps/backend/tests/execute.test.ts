import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { pool } from '../src/db/client.js';
import { runMigrations, truncateAll, closePool } from './helpers.js';

const app = createApp();

beforeAll(async () => { await runMigrations(); });
afterEach(async () => {
  await truncateAll();
  vi.restoreAllMocks();
});
afterAll(async () => { await closePool(); });

async function seedRestResource(name: string, baseUrl: string) {
  await pool.query(
    `INSERT INTO resources (name, type, base_url, auth_type, secret_ref)
     VALUES ($1, 'REST', $2, 'none', NULL)`,
    [name, baseUrl],
  );
}

async function seedDbResource(name: string) {
  await pool.query(
    `INSERT INTO resources (name, type, base_url, auth_type, secret_ref)
     VALUES ($1, 'postgresql', NULL, 'none', $2)`,
    [name, process.env.DATABASE_URL],
  );
}

describe('Execute endpoint', () => {
  it('POST with valid REST resource → proxies and returns data', async () => {
    // Stub global.fetch so tests don't hit the network.
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ ok: true, user: 'alice' }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ));
    vi.stubGlobal('fetch', fetchMock);

    await seedRestResource('mockApi', 'https://api.example.com');

    const res = await request(app).post('/api/execute').send({
      resource: 'mockApi',
      endpoint: '/users/1',
      method:   'GET',
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { ok: true, user: 'alice' } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe('https://api.example.com/users/1');
  });

  it('POST with unknown resource → 404', async () => {
    const res = await request(app).post('/api/execute').send({
      resource: 'does-not-exist',
      endpoint: '/anything',
    });
    expect(res.status).toBe(404);
    expect(res.body.error).toContain('not found');
  });

  it('POST with DB resource containing INSERT → success:false with write-op error', async () => {
    await seedDbResource('localdb');

    const res = await request(app).post('/api/execute').send({
      resource: 'localdb',
      endpoint: "INSERT INTO dashboards (name, slug, config) VALUES ('x', 'x', '{}'::jsonb)",
    });

    // The executor returns success:false with a 200 HTTP (executor-level error, not request-level)
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/not permitted|Write operations/i);
  });
});

describe('Audit log', () => {
  it('query_logs gets a row after /api/execute', async () => {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ));
    vi.stubGlobal('fetch', fetchMock);

    await seedRestResource('logApi', 'https://log.example.com');

    await request(app).post('/api/execute').send({
      resource: 'logApi',
      endpoint: '/metric',
      method:   'GET',
    });

    // Fire-and-forget log — give it a moment to land
    for (let i = 0; i < 20; i++) {
      const { rows } = await pool.query(
        `SELECT resource_name, endpoint, status FROM query_logs WHERE resource_name = $1`,
        ['logApi'],
      );
      if (rows.length > 0) {
        expect(rows[0]).toMatchObject({
          resource_name: 'logApi',
          endpoint:      '/metric',
          status:        'success',
        });
        return;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error('query_logs row never appeared');
  });
});
