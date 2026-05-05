import 'dotenv/config';
import { createApp } from './app.js';
import { createLogger } from './utils/logger.js';

const log = createLogger('server');

process.on('uncaughtException', (err) => {
  log.error('uncaughtException:', err);
  // Fatal conditions: bail out so the watcher can restart cleanly instead of
  // leaving a zombie process with no listener accepting connections.
  if ((err as NodeJS.ErrnoException).code === 'EADDRINUSE') {
    process.exit(1);
  }
});
process.on('unhandledRejection', (reason) => {
  log.error(
    'unhandledRejection — a request handler likely threw without ' +
    'a try/catch and the client is now hanging:',
    reason,
  );
});

const app = createApp();
const port = process.env.PORT || 3001;

app.listen(port, () => {
  log.info(`server listening on port ${port}`);
});
