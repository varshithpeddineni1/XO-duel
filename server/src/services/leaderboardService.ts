// Global and friend leaderboards — derived on read from game_players (DB-7), never stored
// as denormalized ranking rows. Scoped to mode='online' games where *both* seats belong to
// a registered player (API-9: a guest's side of an online game never counts, and neither
// does their registered opponent's side of that same game — the rule scopes eligible games
// to "between registered players", not "each registered player's own side of any game").
// Ranking formula (resolved open decision): win rate, minimum 5 qualifying games.
import { getPool } from '../db/pool.js';

const MIN_GAMES_TO_RANK = 5;

export interface LeaderboardEntry {
  playerId: number;
  displayName: string;
  wins: number;
  losses: number;
  draws: number;
  gamesPlayed: number;
  winRate: number; // 0-100, rounded to 1 decimal
}

interface LeaderboardRow {
  player_id: number;
  username: string | null;
  nickname: string;
  wins: string;
  losses: string;
  draws: string;
  games_played: string;
}

function toEntry(row: LeaderboardRow): LeaderboardEntry {
  const wins = Number(row.wins);
  const gamesPlayed = Number(row.games_played);
  return {
    playerId: row.player_id,
    displayName: row.username ?? row.nickname,
    wins,
    losses: Number(row.losses),
    draws: Number(row.draws),
    gamesPlayed,
    winRate: Math.round((wins / gamesPlayed) * 1000) / 10,
  };
}

async function queryLeaderboard(playerIdFilter?: number[]): Promise<LeaderboardEntry[]> {
  const params: unknown[] = [];
  let filterClause = '';
  if (playerIdFilter) {
    params.push(playerIdFilter);
    filterClause = `AND p.id = ANY($${params.length}::int[])`;
  }

  const { rows } = await getPool().query<LeaderboardRow>(
    `SELECT
       p.id AS player_id, p.username, p.nickname,
       COUNT(*) FILTER (WHERE gp.outcome = 'win') AS wins,
       COUNT(*) FILTER (WHERE gp.outcome = 'loss') AS losses,
       COUNT(*) FILTER (WHERE gp.outcome = 'draw') AS draws,
       COUNT(*) AS games_played
     FROM game_players gp
     JOIN games g ON g.id = gp.game_id
     JOIN players p ON p.id = gp.player_id
     WHERE g.mode = 'online' AND g.status = 'complete'
       AND NOT EXISTS (
         SELECT 1 FROM game_players gp2 WHERE gp2.game_id = g.id AND gp2.player_id IS NULL
       )
       ${filterClause}
     GROUP BY p.id, p.username, p.nickname
     HAVING COUNT(*) >= $${params.length + 1}
     ORDER BY (COUNT(*) FILTER (WHERE gp.outcome = 'win'))::numeric / COUNT(*) DESC,
              COUNT(*) FILTER (WHERE gp.outcome = 'win') DESC`,
    [...params, MIN_GAMES_TO_RANK],
  );

  return rows.map(toEntry);
}

export function getGlobalLeaderboard(): Promise<LeaderboardEntry[]> {
  return queryLeaderboard();
}

export async function getFriendLeaderboard(
  playerId: number,
  friendIds: number[],
): Promise<LeaderboardEntry[]> {
  return queryLeaderboard([playerId, ...friendIds]);
}
