// Per-game history for a registered player (spec §4.2/4.3, API-9). A guest has no stable
// player id to query by, so this is registered-only by construction — there's simply
// nothing to look up for a guest, no separate filtering needed to keep their data out.
import { getPool } from '../db/pool.js';
import type { GameMode } from './gameService.js';

export interface HistoryEntry {
  gameId: number;
  mode: GameMode;
  opponentLabel: string;
  outcome: 'win' | 'loss' | 'draw';
  completedAt: string;
}

interface HistoryRow {
  game_id: number;
  mode: GameMode;
  ai_difficulty: string | null;
  outcome: 'win' | 'loss' | 'draw' | null;
  completed_at: string;
  opponent_username: string | null;
  opponent_nickname: string | null;
}

function opponentLabel(row: HistoryRow): string {
  if (row.mode === 'ai') return `AI (${row.ai_difficulty ?? 'unknown'})`;
  if (row.mode === 'local') return 'Player 2';
  return row.opponent_username ?? row.opponent_nickname ?? 'Opponent';
}

export async function getPlayerHistory(
  playerId: number,
  modeFilter?: GameMode,
): Promise<HistoryEntry[]> {
  const params: unknown[] = [playerId];
  let modeClause = '';
  if (modeFilter) {
    params.push(modeFilter);
    modeClause = 'AND g.mode = $2';
  }

  const { rows } = await getPool().query<HistoryRow>(
    `SELECT
       g.id AS game_id, g.mode, g.ai_difficulty, g.completed_at,
       gp_me.outcome,
       p_opp.username AS opponent_username, p_opp.nickname AS opponent_nickname
     FROM game_players gp_me
     JOIN games g ON g.id = gp_me.game_id
     LEFT JOIN game_players gp_opp ON gp_opp.game_id = g.id AND gp_opp.mark != gp_me.mark
     LEFT JOIN players p_opp ON p_opp.id = gp_opp.player_id
     WHERE gp_me.player_id = $1 AND g.status = 'complete' ${modeClause}
     ORDER BY g.completed_at DESC`,
    params,
  );

  return rows
    .filter((row): row is HistoryRow & { outcome: 'win' | 'loss' | 'draw' } => row.outcome !== null)
    .map((row) => ({
      gameId: row.game_id,
      mode: row.mode,
      opponentLabel: opponentLabel(row),
      outcome: row.outcome,
      completedAt: row.completed_at,
    }));
}
