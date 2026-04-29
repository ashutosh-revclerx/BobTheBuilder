import 'dotenv/config';
import { createApp } from './app.js';

process.on('uncaughtException', (err) => {
  console.error('[server] uncaughtException:', err);
  // Fatal conditions: bail out so the watcher can restart cleanly instead of
  // leaving a zombie process with no listener accepting connections.
  if ((err as NodeJS.ErrnoException).code === 'EADDRINUSE') {
    process.exit(1);
  }
});
process.on('unhandledRejection', (reason) => {
  console.error(
    '[server] unhandledRejection — a request handler likely threw without ' +
    'a try/catch and the client is now hanging:',
    reason,
  );
});

const app = createApp();
const port = process.env.PORT || 3001;

app.listen(port, () => {
  console.log(`[btb-backend] Server is running on port ${port}`);
});
