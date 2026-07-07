import type { PlayerState } from '../api/auth.js';
import { AppHeader } from '../components/AppHeader.js';
import { ScoreTile } from '../components/ScoreTile.js';
import type { Theme } from '../theme/index.js';

interface AccountProps {
  theme: Theme;
  onToggleTheme: () => void;
  player: PlayerState | null;
  onGoLogin: () => void;
  onGoRegister: () => void;
  onLogout: () => void;
}

export function Account({
  theme,
  onToggleTheme,
  player,
  onGoLogin,
  onGoRegister,
  onLogout,
}: AccountProps) {
  const displayName = player?.username ?? player?.nickname ?? 'Guest';
  const accountInitial = displayName.charAt(0).toUpperCase();
  const statusLabel = player?.isRegistered ? 'Signed in' : 'Playing as guest';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <AppHeader theme={theme} onToggleTheme={onToggleTheme} />

      <div style={{ padding: '20px 20px 8px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '22px' }}>
          Account
        </div>
      </div>

      <div
        style={{
          padding: '12px 20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '18px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              background: 'var(--accent-soft)',
              border: '1px solid var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: '20px',
              color: 'var(--accent)',
            }}
          >
            {accountInitial}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '16px' }}>
              {displayName}
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--fg-muted)', marginTop: '2px' }}>
              {statusLabel}
            </div>
          </div>
        </div>

        {player?.isRegistered && player.stats && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <ScoreTile label="Wins" value={player.stats.wins} color="var(--success)" />
            <ScoreTile label="Draws" value={player.stats.draws} color="var(--warning)" />
            <ScoreTile label="Losses" value={player.stats.losses} color="var(--danger)" />
          </div>
        )}

        {!player?.isRegistered && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              onClick={onGoLogin}
              style={{
                background: 'var(--accent)',
                color: 'var(--accent-fg)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                padding: '15px',
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: '15px',
                cursor: 'pointer',
              }}
            >
              Log In
            </button>
            <button
              onClick={onGoRegister}
              style={{
                background: 'var(--surface-raised)',
                color: 'var(--fg)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-md)',
                padding: '14px',
                fontWeight: 700,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Create Account
            </button>
          </div>
        )}

        {player?.isRegistered && (
          <button
            onClick={onLogout}
            style={{
              background: 'transparent',
              color: 'var(--danger)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '14px',
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            Log Out
          </button>
        )}
      </div>
    </div>
  );
}
