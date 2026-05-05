// Tiny logger wrapper. No external deps — just adds ISO timestamps and a
// scope prefix so service logs are greppable in docker compose output.
//
// Usage:
//   const log = createLogger('execute');
//   log.info('hello', { foo: 1 });
//   log.error('boom', err);

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const ENV_LEVEL = (process.env.LOG_LEVEL?.toLowerCase() as Level) || 'info';
const MIN_LEVEL = LEVEL_ORDER[ENV_LEVEL] ?? LEVEL_ORDER.info;

function format(level: Level, scope: string, msg: string, extra: unknown[]): string {
  const ts = new Date().toISOString();
  const tag = level.toUpperCase().padEnd(5, ' ');
  let suffix = '';
  if (extra.length) {
    suffix = ' ' + extra.map((e) => {
      if (e instanceof Error) return `${e.name}: ${e.message}\n${e.stack ?? ''}`;
      if (typeof e === 'object') {
        try { return JSON.stringify(e); } catch { return String(e); }
      }
      return String(e);
    }).join(' ');
  }
  return `${ts} ${tag} [${scope}] ${msg}${suffix}`;
}

function emit(level: Level, scope: string, msg: string, extra: unknown[]): void {
  if (LEVEL_ORDER[level] < MIN_LEVEL) return;
  const line = format(level, scope, msg, extra);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export interface Logger {
  debug: (msg: string, ...extra: unknown[]) => void;
  info:  (msg: string, ...extra: unknown[]) => void;
  warn:  (msg: string, ...extra: unknown[]) => void;
  error: (msg: string, ...extra: unknown[]) => void;
  child: (subScope: string) => Logger;
}

export function createLogger(scope: string): Logger {
  return {
    debug: (msg, ...extra) => emit('debug', scope, msg, extra),
    info:  (msg, ...extra) => emit('info',  scope, msg, extra),
    warn:  (msg, ...extra) => emit('warn',  scope, msg, extra),
    error: (msg, ...extra) => emit('error', scope, msg, extra),
    child: (subScope) => createLogger(`${scope}:${subScope}`),
  };
}

export const rootLogger = createLogger('btb');
