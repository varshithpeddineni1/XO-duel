export type NavDestination = 'home' | 'history' | 'leaderboard' | 'account';

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
      <Tab label="History" active={active === 'history'} onClick={() => onNavigate('history')} />
      <Tab
        label="Ranks"
        active={active === 'leaderboard'}
        onClick={() => onNavigate('leaderboard')}
      />
      <Tab label="Account" active={active === 'account'} onClick={() => onNavigate('account')} />
    </div>
  );
}
