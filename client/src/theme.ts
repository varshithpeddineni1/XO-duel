// Pure theme-resolution logic (ARC-3a: persisted, defaulting to OS preference).
// Kept free of `document`/`localStorage` so it's unit-testable without a DOM (App.tsx wires
// this to the actual browser APIs).
export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'xo-duel-theme';

export function resolveInitialTheme(stored: string | null, prefersDark: boolean): Theme {
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  return prefersDark ? 'dark' : 'light';
}

export function toggleTheme(current: Theme): Theme {
  return current === 'dark' ? 'light' : 'dark';
}
