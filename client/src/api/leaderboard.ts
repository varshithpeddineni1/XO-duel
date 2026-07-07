// Thin fetch wrappers against the server's leaderboard endpoints (Phase 5). Types are
// hand-duplicated from server/src/services/leaderboardService.ts's LeaderboardEntry.
export interface LeaderboardEntry {
  playerId: number;
  displayName: string;
  wins: number;
  losses: number;
  draws: number;
  gamesPlayed: number;
  winRate: number;
}

// Same-origin by default in production so requests hit the Vercel rewrite (vercel.json)
// instead of the cross-site duckdns origin directly — see docs/runbook.md for why
// cross-site cookies fail on mobile Safari/Chrome even with SameSite=None; Secure.
const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  (import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin);

export async function getGlobalLeaderboard(): Promise<LeaderboardEntry[]> {
  const res = await fetch(`${API_URL}/api/leaderboard/global`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to load the leaderboard.');
  return (await res.json()) as LeaderboardEntry[];
}

export async function getFriendLeaderboard(): Promise<LeaderboardEntry[]> {
  const res = await fetch(`${API_URL}/api/friends/leaderboard`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to load the leaderboard.');
  return (await res.json()) as LeaderboardEntry[];
}
