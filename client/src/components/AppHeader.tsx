import { ThemeToggle } from './ThemeToggle.js';
import type { Theme } from '../theme/index.js';

interface AppHeaderProps {
  theme: Theme;
  onToggleTheme: () => void;
}

// Shared by every top-level destination (Home, Account, and eventually History/Leaderboard
// in Phase 5) — the mockup renders this one identical header across all of them.
export function AppHeader({ theme, onToggleTheme }: AppHeaderProps) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '10px',
            background: 'var(--surface-raised)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: '15px',
          }}
        >
          <span style={{ color: 'var(--x-color)' }}>X</span>
          <span style={{ color: 'var(--o-color)' }}>O</span>
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '16px' }}>
          XO Duel
        </div>
      </div>
      <ThemeToggle theme={theme} onToggle={onToggleTheme} />
    </header>
  );
}
