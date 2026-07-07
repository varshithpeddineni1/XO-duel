import { useEffect, useState } from 'react';
import {
  getAdminStats,
  listAdminPlayers,
  type AdminPlayerRow,
  type AdminStats,
} from '../api/admin.js';
import { BackButton } from '../components/BackButton.js';
import { ScoreTile } from '../components/ScoreTile.js';

interface AdminDashboardProps {
  onBack: () => void;
  onLogout: () => void;
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short' });
}

function formatLastSeen(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function cardStyle(): React.CSSProperties {
  return {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '16px',
  };
}

export function AdminDashboard({ onBack, onLogout }: AdminDashboardProps) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [players, setPlayers] = useState<AdminPlayerRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getAdminStats(), listAdminPlayers()])
      .then(([s, p]) => {
        setStats(s);
        setPlayers(p);
      })
      .catch(() => setError('Could not load the dashboard.'));
  }, []);

  const maxDailyCount = Math.max(1, ...(stats?.gamesOverTime.map((d) => d.count) ?? [1]));
  const outcomeTotal = stats
    ? stats.outcomeDistribution.xWins +
      stats.outcomeDistribution.oWins +
      stats.outcomeDistribution.draws
    : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <BackButton onClick={onBack} />
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '16px' }}>
            Admin Dashboard
          </div>
        </div>
        <span
          onClick={onLogout}
          style={{ fontSize: '13px', color: 'var(--danger)', fontWeight: 700, cursor: 'pointer' }}
        >
          Log Out
        </span>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 20px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {error && <div style={{ color: 'var(--danger)', fontSize: '13px' }}>{error}</div>}

        {stats && (
          <>
            <div style={{ display: 'flex', gap: '10px' }}>
              <ScoreTile
                label="Active Players"
                value={stats.activePlayers}
                color="var(--success)"
              />
              <ScoreTile
                label="Games In Progress"
                value={stats.gamesInProgress}
                color="var(--accent)"
              />
            </div>

            <div style={cardStyle()}>
              <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '12px' }}>
                Games Over Time (Last 7 Days)
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '90px' }}>
                {stats.gamesOverTime.map((day) => (
                  <div
                    key={day.date}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '6px',
                      height: '100%',
                      justifyContent: 'flex-end',
                    }}
                  >
                    <div
                      style={{
                        width: '100%',
                        height: `${Math.max(4, (day.count / maxDailyCount) * 100)}%`,
                        background: 'var(--accent)',
                        borderRadius: '4px 4px 0 0',
                      }}
                      title={`${day.count} games`}
                    />
                    <div style={{ fontSize: '10px', color: 'var(--fg-muted)' }}>
                      {formatDay(day.date)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={cardStyle()}>
              <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '12px' }}>
                Outcome Distribution
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(
                  [
                    {
                      label: 'X Wins',
                      value: stats.outcomeDistribution.xWins,
                      color: 'var(--x-color)',
                    },
                    {
                      label: 'O Wins',
                      value: stats.outcomeDistribution.oWins,
                      color: 'var(--o-color)',
                    },
                    {
                      label: 'Draws',
                      value: stats.outcomeDistribution.draws,
                      color: 'var(--warning)',
                    },
                  ] as const
                ).map((row) => (
                  <div
                    key={row.label}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <div
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '2px',
                        background: row.color,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, fontSize: '13px' }}>{row.label}</div>
                    <div style={{ fontSize: '13px', fontWeight: 700 }}>
                      {outcomeTotal > 0 ? Math.round((row.value / outcomeTotal) * 100) : 0}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <div style={cardStyle()}>
          <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '12px' }}>
            Players ({players.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {players.map((p) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ flex: 1, fontSize: '13px', fontWeight: 700 }}>{p.displayName}</div>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: p.isRegistered ? 'var(--accent)' : 'var(--fg-muted)',
                  }}
                >
                  {p.isRegistered ? 'Registered' : 'Guest'}
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    color: 'var(--fg-muted)',
                    width: '60px',
                    textAlign: 'right',
                  }}
                >
                  {formatLastSeen(p.lastSeenAt)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
