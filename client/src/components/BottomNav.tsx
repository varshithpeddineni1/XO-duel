export type NavDestination = 'home' | 'account';

interface BottomNavProps {
  active: NavDestination;
  onNavigate: (destination: NavDestination) => void;
}

interface TabProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

function Tab({ label, active, onClick }: TabProps) {
  const color = active ? 'var(--accent)' : 'var(--fg-faint)';
  return (
    <div
      onClick={onClick}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '5px',
        cursor: 'pointer',
      }}
    >
      <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: color }} />
      <div style={{ fontSize: '11.5px', fontWeight: 700, color }}>{label}</div>
    </div>
  );
}

// Home + Account only for now — History and Leaderboard tabs are added in Phase 5 once
// those destinations actually exist (a tab that leads nowhere is worse than no tab).
export function BottomNav({ active, onNavigate }: BottomNavProps) {
  return (
    <div
      style={{
        display: 'flex',
        borderTop: '1px solid var(--border)',
        padding: '10px 12px 14px',
        flexShrink: 0,
        background: 'var(--bg)',
      }}
    >
      <Tab label="Home" active={active === 'home'} onClick={() => onNavigate('home')} />
      <Tab label="Account" active={active === 'account'} onClick={() => onNavigate('account')} />
    </div>
  );
}
