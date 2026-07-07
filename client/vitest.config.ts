import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 'node' is correct while the only unit-tested code (theme/) is DOM-free. Switch to
    // 'jsdom' (+ Testing Library) if/when component-level unit tests are added — for now
    // components are presentational and covered by the Playwright e2e suite instead.
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/main.tsx',
        'src/App.tsx',
        'src/vite-env.d.ts',
        'src/pages/**',
        'src/components/**',
        'src/api/**',
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
