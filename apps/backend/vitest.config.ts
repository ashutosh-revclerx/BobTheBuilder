import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    // Run tests serially — they all share one test database, so parallel
    // runs would race on truncate/seed.
    fileParallelism: false,
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
