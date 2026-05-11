import { spawn } from 'node:child_process';

const mode = process.argv[2] ?? 'dev';
const npmCli = process.env.npm_execpath;

if (!npmCli) {
  console.error('npm_execpath is not set. Run this script through npm, for example: npm run dev');
  process.exit(1);
}

const commands = mode === 'preview'
  ? [
      { name: 'backend', args: ['run', 'dev', '-w', '@btb/backend'] },
      { name: 'frontend', args: ['run', 'preview', '-w', '@btb/frontend'] },
    ]
  : [
      { name: 'backend', args: ['run', 'dev', '-w', '@btb/backend'] },
      { name: 'frontend', args: ['run', 'dev', '-w', '@btb/frontend'] },
    ];

const children = commands.map(({ name, args }) => {
  const child = spawn(process.execPath, [npmCli, ...args], {
    stdio: ['inherit', 'pipe', 'pipe'],
    env: process.env,
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
