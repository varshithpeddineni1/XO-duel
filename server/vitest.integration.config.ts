import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    // Sequential: tests share one Postgres and don't isolate schemas per test file.
    fileParallelism: false,
    // Short grace period so the disconnect/forfeit test doesn't wait out the real 30s
    // production default.
    env: {
      NODE_ENV: 'test',
      DISCONNECT_GRACE_PERIOD_MS: '300',
      SESSION_SECRET: 'test-session-secret-not-for-production',
      // Hash of 'test-admin-password' (npm run hash-admin -- test-admin-password) — a
      // fixed test-only credential, not a real secret.
      ADMIN_USERNAME: 'admin',
      ADMIN_PASSWORD_HASH:
        '$argon2id$v=19$m=65536,t=3,p=4$oRu49WvQIjPIzkHi6EzxOQ$cEHkEHxgeJq7xSztgw0wYYu0Vy7yD5BGwn/SQGY22eo',
    },
  },
});
