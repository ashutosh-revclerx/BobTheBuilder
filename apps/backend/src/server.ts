import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { pool } from './db/client.js';
import dashboardsRouter from './routes/dashboards.js';
import resourcesRouter  from './routes/resources.js';
import executeRouter    from './routes/execute.js';

process.on('uncaughtException', (err) => {
  console.error('[server] uncaughtException:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[server] unhandledRejection:', reason);
});

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/dashboards', dashboardsRouter);
app.use('/api/resources',  resourcesRouter);
app.use('/api/execute',    executeRouter);

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});


app.listen(port, () => {
  console.log(`[btb-backend] Server is running on port ${port}`);
});
