// Guest and registered player identity (SEC-2, SEC-3). A guest is just a nickname + a
// players row created silently on first visit; registering upgrades that same row in
// place (username, password_hash, is_registered) rather than creating a second one, so
// anything already attributed to it (game_players.player_id) is retained automatically.
import argon2 from 'argon2';
import { randomInt } from 'node:crypto';
import { getPool } from '../db/pool.js';
import {
  AlreadyRegisteredError,
  InvalidCredentialsError,
  UsernameTakenError,
} from '../lib/errors.js';

export interface PlayerState {
  id: number;
  nickname: string;
  username: string | null;
  isRegistered: boolean;
}

interface PlayerRow {
  id: number;
  nickname: string;
  username: string | null;
  is_registered: boolean;
}

const PLAYER_ROW_COLUMNS = 'id, nickname, username, is_registered';

function toPlayerState(row: PlayerRow): PlayerState {
  return {
    id: row.id,
    nickname: row.nickname,
    username: row.username,
    isRegistered: row.is_registered,
  };
}

function generateGuestNickname(): string {
  return `Guest-${randomInt(1000, 10_000)}`;
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';
}

// Loads the player behind an existing session, touching last_seen_at; creates a fresh
// guest row (and returns it) if there is no session yet, or it pointed at a row that no
// longer exists.
export async function getOrCreatePlayer(existingPlayerId: number | null): Promise<PlayerState> {
  const pool = getPool();

  if (existingPlayerId !== null) {
    const { rows } = await pool.query<PlayerRow>(
      `UPDATE players SET last_seen_at = now() WHERE id = $1 RETURNING ${PLAYER_ROW_COLUMNS}`,
      [existingPlayerId],
    );
    const row = rows[0];
    if (row) return toPlayerState(row);
  }

  const { rows } = await pool.query<PlayerRow>(
    `INSERT INTO players (nickname) VALUES ($1) RETURNING ${PLAYER_ROW_COLUMNS}`,
    [generateGuestNickname()],
  );
  const row = rows[0];
  if (!row) throw new Error('player insert returned no row');
  return toPlayerState(row);
}

export async function getPlayerById(playerId: number): Promise<PlayerState | null> {
  const { rows } = await getPool().query<PlayerRow>(
    `SELECT ${PLAYER_ROW_COLUMNS} FROM players WHERE id = $1`,
    [playerId],
  );
  const row = rows[0];
  return row ? toPlayerState(row) : null;
}

export async function registerAccount(
  playerId: number,
  username: string,
  password: string,
): Promise<PlayerState> {
  const passwordHash = await argon2.hash(password);
  try {
    const { rows } = await getPool().query<PlayerRow>(
      `UPDATE players SET username = $2, password_hash = $3, is_registered = true
       WHERE id = $1 AND is_registered = false
       RETURNING ${PLAYER_ROW_COLUMNS}`,
      [playerId, username, passwordHash],
    );
    const row = rows[0];
    if (!row) throw new AlreadyRegisteredError();
    return toPlayerState(row);
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new UsernameTakenError(`Username "${username}" is already taken.`);
    }
    throw err;
  }
}

export async function loginAccount(username: string, password: string): Promise<PlayerState> {
  const { rows } = await getPool().query<PlayerRow & { password_hash: string | null }>(
    `SELECT ${PLAYER_ROW_COLUMNS}, password_hash FROM players
     WHERE username = $1 AND is_registered = true`,
    [username],
  );
  const row = rows[0];
  // Same error for "no such username" and "wrong password" — don't let login responses be
  // used to enumerate registered usernames.
  if (!row?.password_hash || !(await argon2.verify(row.password_hash, password))) {
    throw new InvalidCredentialsError();
  }

  await getPool().query('UPDATE players SET last_seen_at = now() WHERE id = $1', [row.id]);
  return toPlayerState(row);
}

export interface PlayerStats {
  wins: number;
  losses: number;
  draws: number;
}

export async function getPlayerStats(playerId: number): Promise<PlayerStats> {
  const { rows } = await getPool().query<{ outcome: 'win' | 'loss' | 'draw'; count: string }>(
    `SELECT outcome, COUNT(*) FROM game_players
     WHERE player_id = $1 AND outcome IS NOT NULL
     GROUP BY outcome`,
    [playerId],
  );
  const stats: PlayerStats = { wins: 0, losses: 0, draws: 0 };
  for (const row of rows) {
    if (row.outcome === 'win') stats.wins = Number(row.count);
    else if (row.outcome === 'loss') stats.losses = Number(row.count);
    else if (row.outcome === 'draw') stats.draws = Number(row.count);
  }
  return stats;
}
