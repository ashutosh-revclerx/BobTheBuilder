import express from 'express';
import cors from 'cors';
import { pool } from './db/client.js';
import dashboardsRouter from './routes/dashboards.js';
import resourcesRouter  from './routes/resources.js';
import executeRouter    from './routes/execute.js';
import customersRouter  from './routes/customers.js';
import { createLogger } from './utils/logger.js';

const log = createLogger('http');

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Request logging — method, path, status, duration. Skip /health to avoid
  // spamming logs when docker / load balancers probe every second.
  app.use((req, res, next) => {
    if (req.path === '/health') return next();
    const start = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - start;
      const line = `${req.method} ${req.originalUrl} → ${res.statusCode} (${ms}ms)`;
      if (res.statusCode >= 500) log.error(line);
      else if (res.statusCode >= 400) log.warn(line);
      else log.info(line);
    });
    next();
  });

  app.use('/api/dashboards', dashboardsRouter);
  app.use('/api/resources',  resourcesRouter);
  app.use('/api/execute',    executeRouter);
  app.use('/api/customers',  customersRouter);

  app.get('/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok', db: 'connected' });
    } catch {
      res.status(503).json({ status: 'error', db: 'disconnected' });
    }
  });

  // Express 4 doesn't automatically forward async throws — without this, a thrown
  // promise in any route hits process-level unhandledRejection and the client
  // just hangs waiting for a response that never comes.
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    log.error('route error:', err);
    if (res.headersSent) return;
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
