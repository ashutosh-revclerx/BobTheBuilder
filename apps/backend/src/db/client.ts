import 'dotenv/config';
import { Pool } from 'pg';
import { createLogger } from '../utils/logger.js';

const log = createLogger('db');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  log.error('unexpected pool error', err);
});

pool.on('connect', () => {
  log.debug('new client connected to pool');
});
