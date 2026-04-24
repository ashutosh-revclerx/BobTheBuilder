import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { runMigrations, truncateAll, closePool } from './helpers.js';

const app = createApp();

beforeAll(async () => { await runMigrations(); });
afterEach(async () => { await truncateAll(); });
afterAll(async () => { await closePool(); });

describe('Customers flows', () => {
  it('POST → 201', async () => {
    const res = await request(app).post('/api/customers').send({ name: 'Acme', slug: 'acme' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Acme', slug: 'acme' });
  });

  it('POST with bad slug (spaces) → 400', async () => {
    const res = await request(app).post('/api/customers').send({ name: 'Acme', slug: 'has spaces' });
    expect(res.status).toBe(400);
  });

  it('GET /:slug/dashboard → 200 with nested customer + dashboard', async () => {
    const dash = await request(app).post('/api/dashboards').send({
      name: 'Acme Main',
      config: { components: [{ id: 's1', type: 'StatCard', label: 'X' }], queries: [] },
    });
    const cust = await request(app).post('/api/customers').send({
      name: 'Acme',
      slug: 'acme',
      dashboard_id: dash.body.id,
      brand_config: { primaryColor: '#0ea5e9' },
    });
    expect(cust.status).toBe(201);

    const res = await request(app).get('/api/customers/acme/dashboard');
    expect(res.status).toBe(200);
    expect(res.body.customer).toMatchObject({ slug: 'acme', brand_config: { primaryColor: '#0ea5e9' } });
    expect(res.body.dashboard).toMatchObject({ id: dash.body.id, name: 'Acme Main' });
    expect(res.body.dashboard.config.components).toHaveLength(1);
  });

  it('GET /unknown-slug/dashboard → 404', async () => {
    const res = await request(app).get('/api/customers/nope/dashboard');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Customer not found');
  });
});
