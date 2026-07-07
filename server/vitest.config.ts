import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Integration tests (*.integration.test.ts) need a real Postgres and run separately
    // via vitest.integration.config.ts / `npm run test:integration` — this default run
    // must stay DB-free (per CLAUDE.md).
    exclude: ['**/node_modules/**', '**/dist/**', 'src/**/*.integration.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.integration.test.ts',
        'src/index.ts',
        'src/config/**',
        'src/db/**',
        'src/lib/**',
        // DB-coupled — exercised by the separate integration suite, not the unit gate.
        'src/routes/**',
        'src/services/**',
        'src/middleware/**',
        'src/sockets/**',
        'src/openapi.ts',
      ],
      thresholds: {
        lines: 80,
        statements: 80,
        branches: 80,
        functions: 80,
      },
    },
  },
});
