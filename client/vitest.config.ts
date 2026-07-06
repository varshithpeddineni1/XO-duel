import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 'node' is correct while the only unit-tested file (theme.ts) is DOM-free. Switch to
    // 'jsdom' once component tests are added (Phase 2's Board/Cell/etc.).
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/main.tsx', 'src/App.tsx', 'src/vite-env.d.ts'],
      thresholds: {
        lines: 80,
        statements: 80,
        branches: 80,
        functions: 80,
      },
    },
  },
});
