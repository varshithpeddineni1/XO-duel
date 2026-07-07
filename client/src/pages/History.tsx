import { useEffect, useState } from 'react';
import type { GameMode } from '../api/games.js';
import { getHistory, type HistoryEntry } from '../api/history.js';
import { AppHeader } from '../components/AppHeader.js';
import type { Theme } from '../theme/index.js';

interface HistoryProps {
  theme: Theme;
  onToggleTheme: () => void;
}

const FILTERS: Array<{ key: GameMode | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'local', label: 'Local' },
  { key: 'ai', label: 'vs AI' },
  { key: 'online', label: 'Online' },
];

const MODE_LABELS: Record<GameMode, string> = { local: 'Local', ai: 'vs AI', online: 'Online' };

function resultStyle(outcome: 'win' | 'loss' | 'draw') {
  if (outcome === 'win') {
    return { bg: 'var(--success-soft)', color: 'var(--success)', label: 'Win' };
  }
  if (outcome === 'loss') {
    return { bg: 'var(--danger-soft)', color: 'var(--danger)', label: 'Loss' };
  }
  return { bg: 'var(--warning-soft)', color: 'var(--warning)', label: 'Draw' };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function History({ theme, onToggleTheme }: HistoryProps) {
  const [filter, setFilter] = useState<GameMode | 'all'>('all');
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getHistory(filter === 'all' ? undefined : filter)
      .then((data) => {
        if (!cancelled) setEntries(data);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load history.');
      });
    return () => {
      cancelled = true;
    };
  }, [filter]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <AppHeader theme={theme} onToggleTheme={onToggleTheme} />

      <div style={{ padding: '20px 20px 8px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '22px' }}>
          Game History
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', padding: '4px 20px 12px', overflowX: 'auto' }}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                flexShrink: 0,
                padding: '8px 14px',
                borderRadius: '999px',
                border: active ? 'none' : '1px solid var(--border)',
                background: active ? 'var(--accent)' : 'var(--surface)',
                color: active ? 'var(--accent-fg)' : 'var(--fg-muted)',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 20px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
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
            No games yet.
          </div>
        )}
        {entries.map((entry) => {
          const result = resultStyle(entry.outcome);
          return (
            <div
              key={entry.gameId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '12px',
              }}
            >
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
                {entry.opponentLabel.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '14px' }}>{entry.opponentLabel}</div>
                <div style={{ fontSize: '12px', color: 'var(--fg-muted)', marginTop: '2px' }}>
                  {MODE_LABELS[entry.mode]} · {formatDate(entry.completedAt)}
                </div>
              </div>
              <div
                style={{
                  padding: '4px 10px',
                  borderRadius: '999px',
                  background: result.bg,
                  color: result.color,
                  fontSize: '12px',
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {result.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
