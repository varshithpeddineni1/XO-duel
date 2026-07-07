import { useEffect, useState } from 'react';
import {
  getFriendLeaderboard,
  getGlobalLeaderboard,
  type LeaderboardEntry,
} from '../api/leaderboard.js';
import { AppHeader } from '../components/AppHeader.js';
import type { Theme } from '../theme/index.js';

interface LeaderboardProps {
  theme: Theme;
  onToggleTheme: () => void;
  myPlayerId: number | null;
  onManageFriends: () => void;
}

type Tab = 'friends' | 'global';

function rankColor(rank: number): string {
  if (rank === 1) return 'var(--warning)';
  if (rank === 2) return 'var(--fg-muted)';
  if (rank === 3) return 'var(--o-color)';
  return 'var(--fg-faint)';
}

export function Leaderboard({
  theme,
  onToggleTheme,
  myPlayerId,
  onManageFriends,
}: LeaderboardProps) {
  const [tab, setTab] = useState<Tab>('friends');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = tab === 'friends' ? getFriendLeaderboard : getGlobalLeaderboard;
    load()
      .then((data) => {
        if (!cancelled) setEntries(data);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load the leaderboard.');
      });
    return () => {
      cancelled = true;
    };
  }, [tab]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <AppHeader theme={theme} onToggleTheme={onToggleTheme} />

      <div style={{ padding: '20px 20px 8px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '22px' }}>
          Leaderboard
        </div>
      </div>

      <div style={{ display: 'flex', gap: '6px', padding: '4px 20px 12px' }}>
        {(['friends', 'global'] as const).map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: active ? 'var(--accent-soft)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--fg-muted)',
                fontWeight: 700,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              {t === 'friends' ? 'Friends' : 'Global'}
            </button>
          );
        })}
      </div>

      {tab === 'friends' && (
        <div style={{ padding: '0 20px 8px', textAlign: 'right' }}>
          <span
            onClick={onManageFriends}
            style={{ fontSize: '13px', color: 'var(--accent)', fontWeight: 700, cursor: 'pointer' }}
          >
            Manage Friends
          </span>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '4px 20px',
          fontSize: '11px',
          fontWeight: 700,
          color: 'var(--fg-muted)',
          textTransform: 'uppercase',
        }}
      >
        <div style={{ width: '20px' }}>#</div>
        <div style={{ width: '38px' }} />
        <div style={{ flex: 1 }}>Player</div>
        <div>Record</div>
        <div style={{ width: '50px', textAlign: 'right' }}>Win %</div>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '4px 20px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {error && <div style={{ color: 'var(--danger)', fontSize: '13px' }}>{error}</div>}
        {!error && entries.length === 0 && (
          <div
            style={{
              color: 'var(--fg-muted)',
              fontSize: '14px',
              textAlign: 'center',
              marginTop: '40px',
            }}
          >
            No ranked players yet — play 5+ online games to qualify.
          </div>
        )}
        {entries.map((entry, index) => {
          const rank = index + 1;
          const isMe = entry.playerId === myPlayerId;
          return (
            <div
              key={entry.playerId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                background: isMe ? 'var(--accent-soft)' : 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 12px',
              }}
            >
              <div
                style={{
                  width: '20px',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  color: rankColor(rank),
                }}
              >
                {rank}
              </div>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: '14px',
                  flexShrink: 0,
                }}
              >
                {entry.displayName.charAt(0).toUpperCase()}
              </div>
              <div
                style={{
                  flex: 1,
                  fontWeight: 700,
                  fontSize: '14px',
                  color: isMe ? 'var(--accent)' : 'var(--fg)',
                }}
              >
                {entry.displayName}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--fg-muted)' }}>
                {entry.wins}-{entry.losses}-{entry.draws}
              </div>
              <div
                style={{
                  width: '50px',
                  textAlign: 'right',
                  fontWeight: 700,
                  fontFamily: 'var(--font-display)',
                }}
              >
                {entry.winRate}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
