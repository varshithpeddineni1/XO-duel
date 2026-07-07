import type { Theme } from '../theme/index.js';

interface ThemeToggleProps {
  theme: Theme;
  onToggle: () => void;
}

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      style={{
        width: '44px',
        height: '24px',
        borderRadius: 'var(--radius-full)',
        background: isDark ? 'var(--accent)' : 'var(--border-strong)',
        position: 'relative',
        cursor: 'pointer',
        flexShrink: 0,
        border: 'none',
        padding: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '2px',
          left: isDark ? '22px' : '2px',
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          background: 'var(--surface)',
          transition: 'left 0.2s',
        }}
      />
    </button>
  );
}
