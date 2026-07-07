// Real admin auth (SEC-2) and the read-only dashboard (SEC-10) — replaces the mockup's
// hardcoded client-side admin check entirely, not reused in any form. There is no admin
// database row: a single identity configured via ADMIN_USERNAME/ADMIN_PASSWORD_HASH env
// vars (SEC-1), hashed with the same scripts/hash-admin.mjs script from Phase 1.
import argon2 from 'argon2';
import { env } from '../config/env.js';
import { getPool } from '../db/pool.js';

export async function verifyAdminCredentials(username: string, password: string): Promise<boolean> {
  if (!env.adminUsername || !env.adminPasswordHash) return false;
  if (username !== env.adminUsername) return false;
  return argon2.verify(env.adminPasswordHash, password);
}

// "Active players" and "games in progress" are current-state snapshots (players/games are
// the source of truth for those, not a log) — "games over time" and "outcome distribution"
// are genuinely historical/event-log questions, so those two read from `events` per OBS-3.
const ACTIVE_WINDOW_MINUTES = 5;
const GAMES_OVER_TIME_DAYS = 7;

export interface AdminStats {
  activePlayers: number;
  gamesInProgress: number;
  gamesOverTime: Array<{ date: string; count: number }>;
  outcomeDistribution: { xWins: number; oWins: number; draws: number };
}

export async function getAdminStats(): Promise<AdminStats> {
  const pool = getPool();

  const [activePlayersResult, gamesInProgressResult, gamesOverTimeResult, outcomeResult] =
    await Promise.all([
      pool.query<{ count: string }>(
        `SELECT COUNT(*) FROM players WHERE last_seen_at >= now() - interval '${ACTIVE_WINDOW_MINUTES} minutes'`,
      ),
      pool.query<{ count: string }>("SELECT COUNT(*) FROM games WHERE status = 'in_progress'"),
      pool.query<{ day: string; count: string }>(
        `SELECT date_trunc('day', created_at)::date AS day, COUNT(*)
         FROM events
         WHERE type IN ('game_completed', 'game_forfeited')
           AND created_at >= now() - interval '${GAMES_OVER_TIME_DAYS} days'
         GROUP BY day
         ORDER BY day ASC`,
      ),
      pool.query<{ winner: string; count: string }>(
        `SELECT payload->>'winner' AS winner, COUNT(*)
         FROM events
         WHERE type IN ('game_completed', 'game_forfeited')
         GROUP BY winner`,
      ),
    ]);

  const outcomeDistribution = { xWins: 0, oWins: 0, draws: 0 };
  for (const row of outcomeResult.rows) {
    if (row.winner === 'X') outcomeDistribution.xWins = Number(row.count);
    else if (row.winner === 'O') outcomeDistribution.oWins = Number(row.count);
    else if (row.winner === 'draw') outcomeDistribution.draws = Number(row.count);
  }

  return {
    activePlayers: Number(activePlayersResult.rows[0]?.count ?? 0),
    gamesInProgress: Number(gamesInProgressResult.rows[0]?.count ?? 0),
    gamesOverTime: gamesOverTimeResult.rows.map((row) => ({
      date: row.day,
      count: Number(row.count),
    })),
    outcomeDistribution,
  };
}

export interface AdminPlayerRow {
  id: number;
  displayName: string;
  isRegistered: boolean;
  lastSeenAt: string;
}

export async function listPlayers(limit: number, offset: number): Promise<AdminPlayerRow[]> {
  const { rows } = await getPool().query<{
    id: number;
    username: string | null;
    nickname: string;
    is_registered: boolean;
    last_seen_at: string;
  }>(
    `SELECT id, username, nickname, is_registered, last_seen_at
     FROM players
     ORDER BY last_seen_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  return rows.map((row) => ({
    id: row.id,
    displayName: row.username ?? row.nickname,
    isRegistered: row.is_registered,
    lastSeenAt: row.last_seen_at,
  }));
}
