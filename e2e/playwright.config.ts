import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      // Real API server (built, not the tsx dev watcher) — Phase 2's game flows need it.
      // Needs DATABASE_URL already set in the environment (see ci.yml's `e2e` job, or
      // export it yourself for local runs against a reachable Postgres).
      command: 'npm run build --workspace server && node server/dist/index.js',
      url: 'http://localhost:3000/api/health',
      reuseExistingServer: !process.env.CI,
      cwd: '..',
      timeout: 60_000,
      env: {
        PORT: '3000',
        CLIENT_ORIGIN: 'http://localhost:4173',
        // Short enough that the disconnect/forfeit e2e test doesn't wait out the real 30s
        // production default.
        DISCONNECT_GRACE_PERIOD_MS: '2000',
        SESSION_SECRET: 'e2e-session-secret-not-for-production',
      },
    },
    {
      command: 'npm run build --workspace client && npm run preview --workspace client',
      url: 'http://localhost:4173',
      reuseExistingServer: !process.env.CI,
      cwd: '..',
      timeout: 60_000,
      env: {
        VITE_API_URL: 'http://localhost:3000',
        VITE_SOCKET_URL: 'http://localhost:3000',
      },
    },
  ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
