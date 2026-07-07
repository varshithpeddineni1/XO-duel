import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    // Sequential: tests share one Postgres and don't isolate schemas per test file.
    fileParallelism: false,
    // Short grace period so the disconnect/forfeit test doesn't wait out the real 30s
    // production default.
    env: { NODE_ENV: 'test', DISCONNECT_GRACE_PERIOD_MS: '300' },
  },
});
