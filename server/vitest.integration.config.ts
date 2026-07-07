import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    // Sequential: tests share one Postgres and don't isolate schemas per test file.
    fileParallelism: false,
    env: { NODE_ENV: 'test' },
  },
});
