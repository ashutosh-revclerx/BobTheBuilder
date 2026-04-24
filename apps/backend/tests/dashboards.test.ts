import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { runMigrations, truncateAll, closePool } from './helpers.js';

const app = createApp();

beforeAll(async () => { await runMigrations(); });
afterEach(async () => { await truncateAll(); });
afterAll(async () => { await closePool(); });

const validConfig = {
  components: [{ id: 'c1', type: 'StatCard', label: 'Hello' }],
  queries:    [],
};

describe('Dashboards CRUD', () => {
  it('POST → 201 with valid config', async () => {
    const res = await request(app).post('/api/dashboards').send({ name: 'D1', config: validConfig });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'D1', slug: 'd1', config: validConfig });
    expect(res.body.id).toBeTypeOf('string');
  });

  it('POST → 400 with invalid config (missing components)', async () => {
    const res = await request(app).post('/api/dashboards').send({ name: 'D1', config: { queries: [] } });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('GET /:id → 200 with full config', async () => {
    const created = await request(app).post('/api/dashboards').send({ name: 'D1', config: validConfig });
    const res = await request(app).get(`/api/dashboards/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.config).toEqual(validConfig);
  });

  it('GET /:id for nonexistent → 404', async () => {
    const res = await request(app).get('/api/dashboards/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });

  it('PUT /:id → 200 updated', async () => {
    const created = await request(app).post('/api/dashboards').send({ name: 'D1', config: validConfig });
    const res = await request(app).put(`/api/dashboards/${created.body.id}`).send({ name: 'D1 Renamed' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('D1 Renamed');
  });

  it('DELETE /:id → 204, then GET → 404', async () => {
    const created = await request(app).post('/api/dashboards').send({ name: 'D1', config: validConfig });
    const del = await request(app).delete(`/api/dashboards/${created.body.id}`);
    expect(del.status).toBe(204);
    const after = await request(app).get(`/api/dashboards/${created.body.id}`);
    expect(after.status).toBe(404);
  });
});
