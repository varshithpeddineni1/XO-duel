import { useEffect, useState } from 'react';
import { resolveInitialTheme, toggleTheme, THEME_STORAGE_KEY, type Theme } from './theme.js';

// Minimal placeholder — not one of the 11 real screens (Phase 2+). Exists so the design
// tokens are visibly wired up and the Playwright smoke test has something real to check.
// Spacing/sizing below is hardcoded rather than tokenized (unlike color/font/radius, which
// all come from tokens.css) since this component is deleted wholesale in Phase 2 — not a
// pattern to copy into a real screen.
export function App() {
  // Lazy initializer so the correct theme is picked before the first paint (no dark-theme
  // flash while an effect runs).
  const [theme, setTheme] = useState<Theme>(() =>
    resolveInitialTheme(
      localStorage.getItem(THEME_STORAGE_KEY),
      window.matchMedia('(prefers-color-scheme: dark)').matches,
    ),
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const handleToggle = () => {
    setTheme((current) => {
      const next = toggleTheme(current);
      localStorage.setItem(THEME_STORAGE_KEY, next);
      return next;
    });
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '14px',
        textAlign: 'center',
        padding: '24px',
      }}
    >
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '32px' }}>
        <span style={{ color: 'var(--x-color)' }}>X</span>
        <span style={{ color: 'var(--o-color)' }}>O</span> Duel
      </div>
      <p style={{ color: 'var(--fg-muted)', maxWidth: '280px' }}>
        Challenge anyone. Anywhere. Anytime.
      </p>
      <button
        type="button"
        onClick={handleToggle}
        style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 700,
          background: 'var(--surface-raised)',
          color: 'var(--fg)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 18px',
          cursor: 'pointer',
        }}
      >
        Switch to {theme === 'dark' ? 'light' : 'dark'} mode
      </button>
    </main>
  );
}
