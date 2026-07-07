// Thin fetch wrapper against the server's history endpoint (Phase 5). Types are
// hand-duplicated from server/src/services/historyService.ts's HistoryEntry.
import type { GameMode } from './games.js';

export interface HistoryEntry {
  gameId: number;
  mode: GameMode;
  opponentLabel: string;
  outcome: 'win' | 'loss' | 'draw';
  completedAt: string;
}

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';

export async function getHistory(modeFilter?: GameMode): Promise<HistoryEntry[]> {
  const url = new URL(`${API_URL}/api/games/history`);
  if (modeFilter) url.searchParams.set('mode', modeFilter);
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to load history.');
  return (await res.json()) as HistoryEntry[];
}
