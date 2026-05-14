import { spawn } from 'node:child_process';

const mode = process.argv[2] ?? 'dev';
const pythonCli = process.env.PYTHON ?? 'python';
const npmScript = mode === 'preview' ? 'preview' : 'dev';
const backendArgs = mode === 'preview'
  ? ['-m', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', '3001']
  : ['-m', 'uvicorn', 'app.main:app', '--reload', '--host', '0.0.0.0', '--port', '3001'];

const commands = [
  { name: 'backend',  command: pythonCli, args: backendArgs,                   cwd: 'backend'  },
  { name: 'frontend', command: 'npm',     args: ['run', npmScript],            cwd: 'frontend' },
];

const children = commands.map(({ name, command, args, cwd }) => {
  const child = spawn(command, args, {
    cwd,
    stdio: ['inherit', 'pipe', 'pipe'],
    env: process.env,
    shell: process.platform === 'win32',
  });

  const prefix = `[${name}] `;
  child.stdout.on('data', (chunk) => {
    process.stdout.write(String(chunk).replace(/^/gm, prefix));
  });
  child.stderr.on('data', (chunk) => {
    process.stderr.write(String(chunk).replace(/^/gm, prefix));
  });

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    console.error(`${prefix}exited with ${signal ?? code}`);
    shutdown(code ?? 1);
  });

  return child;
});

let shuttingDown = false;

function shutdown(code = 0) {
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }
  process.exitCode = code;
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
