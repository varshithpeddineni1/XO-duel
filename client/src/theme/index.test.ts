import { describe, expect, it } from 'vitest';
import { resolveInitialTheme, toggleTheme } from './index.js';

describe('resolveInitialTheme', () => {
  it('honors a persisted dark theme even if the OS prefers light', () => {
    expect(resolveInitialTheme('dark', false)).toBe('dark');
  });

  it('honors a persisted light theme even if the OS prefers dark', () => {
    expect(resolveInitialTheme('light', true)).toBe('light');
  });

  it('falls back to the OS preference when nothing is persisted (dark)', () => {
    expect(resolveInitialTheme(null, true)).toBe('dark');
  });

  it('falls back to the OS preference when nothing is persisted (light)', () => {
    expect(resolveInitialTheme(null, false)).toBe('light');
  });

  it('ignores a garbage stored value and falls back to the OS preference', () => {
    expect(resolveInitialTheme('not-a-theme', true)).toBe('dark');
  });

  it('treats an empty stored value the same as no stored value', () => {
    expect(resolveInitialTheme('', true)).toBe('dark');
    expect(resolveInitialTheme('', false)).toBe('light');
  });
});

describe('toggleTheme', () => {
  it('flips dark to light', () => {
    expect(toggleTheme('dark')).toBe('light');
  });

  it('flips light to dark', () => {
    expect(toggleTheme('light')).toBe('dark');
  });
});
