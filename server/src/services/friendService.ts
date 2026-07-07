// Friends: search, request/accept/decline, and reusable personal invite links (spec §7-8).
// The `friendships` unique constraint only covers the *ordered* pair (requester, addressee)
// — it does not by itself stop two players from independently requesting each other, so the
// checks below look at both orderings before deciding whether to insert, update, or no-op.
import type { Pool, PoolClient } from 'pg';
import { getPool } from '../db/pool.js';
import { generateFriendInviteCode } from '../domain/inviteCode.js';
import {
  AlreadyFriendsError,
  CannotFriendSelfError,
  FriendRequestNotFoundError,
  InvalidInviteCodeError,
  PlayerNotFoundError,
} from '../lib/errors.js';

export interface FriendSummary {
  playerId: number;
  displayName: string;
}

export interface PendingRequest {
  requestId: number;
  direction: 'incoming' | 'outgoing';
  playerId: number;
  displayName: string;
  createdAt: string;
}

interface FriendshipRow {
  id: number;
  requester_id: number;
  addressee_id: number;
  status: 'pending' | 'accepted';
}

function displayName(row: { username: string | null; nickname: string }): string {
  return row.username ?? row.nickname;
}

async function findExistingFriendship(
  client: PoolClient,
  aId: number,
  bId: number,
): Promise<FriendshipRow | null> {
  const { rows } = await client.query<FriendshipRow>(
    `SELECT id, requester_id, addressee_id, status FROM friendships
     WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)`,
    [aId, bId],
  );
  return rows[0] ?? null;
}

export async function searchPlayers(
  query: string,
  excludePlayerId: number,
): Promise<FriendSummary[]> {
  const { rows } = await getPool().query<{ id: number; username: string | null; nickname: string }>(
    `SELECT id, username, nickname FROM players
     WHERE is_registered = true AND id != $1 AND username ILIKE $2
     ORDER BY username ASC
     LIMIT 20`,
    [excludePlayerId, `${query}%`],
  );
  return rows.map((row) => ({ playerId: row.id, displayName: displayName(row) }));
}

export async function sendFriendRequest(
  requesterId: number,
  targetUsername: string,
): Promise<void> {
  const { rows: targetRows } = await getPool().query<{ id: number }>(
    'SELECT id FROM players WHERE username = $1 AND is_registered = true',
    [targetUsername],
  );
  const target = targetRows[0];
  if (!target) throw new PlayerNotFoundError(targetUsername);
  if (target.id === requesterId) throw new CannotFriendSelfError();

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const existing = await findExistingFriendship(client, requesterId, target.id);

    if (existing?.status === 'accepted') {
      await client.query('ROLLBACK');
      throw new AlreadyFriendsError();
    }
    if (existing?.status === 'pending') {
      if (existing.requester_id === requesterId) {
        await client.query('COMMIT'); // already requested — idempotent no-op
        return;
      }
      // The target already requested *me* — a mutual request is an instant match.
      await client.query("UPDATE friendships SET status = 'accepted' WHERE id = $1", [existing.id]);
      await client.query('COMMIT');
      return;
    }

    await client.query(
      "INSERT INTO friendships (requester_id, addressee_id, status) VALUES ($1, $2, 'pending')",
      [requesterId, target.id],
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function respondToFriendRequest(
  playerId: number,
  requestId: number,
  accept: boolean,
): Promise<void> {
  const { rows } = await getPool().query<FriendshipRow>(
    "SELECT id, requester_id, addressee_id, status FROM friendships WHERE id = $1 AND addressee_id = $2 AND status = 'pending'",
    [requestId, playerId],
  );
  if (!rows[0]) throw new FriendRequestNotFoundError();

  if (accept) {
    await getPool().query("UPDATE friendships SET status = 'accepted' WHERE id = $1", [requestId]);
  } else {
    // No 'declined' status exists in the schema's check constraint — decline just removes
    // the row, leaving the pair free to request again later.
    await getPool().query('DELETE FROM friendships WHERE id = $1', [requestId]);
  }
}

// Reusable by design (SEC-4) — visiting someone's personal link and confirming is a
// one-step action, the same way joining a game via invite code is, not a second
// request/accept round trip.
export async function acceptInviteLink(playerId: number, code: string): Promise<void> {
  const { rows } = await getPool().query<{ id: number }>(
    'SELECT id FROM players WHERE invite_code = $1',
    [code],
  );
  const owner = rows[0];
  if (!owner) throw new InvalidInviteCodeError();
  if (owner.id === playerId) throw new CannotFriendSelfError();

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const existing = await findExistingFriendship(client, playerId, owner.id);
    if (existing) {
      if (existing.status !== 'accepted') {
        await client.query("UPDATE friendships SET status = 'accepted' WHERE id = $1", [
          existing.id,
        ]);
      }
    } else {
      await client.query(
        "INSERT INTO friendships (requester_id, addressee_id, status) VALUES ($1, $2, 'accepted')",
        [playerId, owner.id],
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function listFriends(playerId: number): Promise<FriendSummary[]> {
  const { rows } = await getPool().query<{ id: number; username: string | null; nickname: string }>(
    `SELECT p.id, p.username, p.nickname
     FROM friendships f
     JOIN players p ON p.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
     WHERE f.status = 'accepted' AND (f.requester_id = $1 OR f.addressee_id = $1)
     ORDER BY p.username ASC`,
    [playerId],
  );
  return rows.map((row) => ({ playerId: row.id, displayName: displayName(row) }));
}

export async function getFriendIds(playerId: number): Promise<number[]> {
  const friends = await listFriends(playerId);
  return friends.map((f) => f.playerId);
}

export async function listPendingRequests(playerId: number): Promise<PendingRequest[]> {
  const { rows } = await getPool().query<{
    id: number;
    requester_id: number;
    addressee_id: number;
    created_at: string;
    other_id: number;
    username: string | null;
    nickname: string;
  }>(
    `SELECT f.id, f.requester_id, f.addressee_id, f.created_at,
            p.id AS other_id, p.username, p.nickname
     FROM friendships f
     JOIN players p ON p.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
     WHERE f.status = 'pending' AND (f.requester_id = $1 OR f.addressee_id = $1)
     ORDER BY f.created_at DESC`,
    [playerId],
  );
  return rows.map((row) => ({
    requestId: row.id,
    direction: row.requester_id === playerId ? 'outgoing' : 'incoming',
    playerId: row.other_id,
    displayName: displayName(row),
    createdAt: row.created_at,
  }));
}

// Generates a unique, permanent invite code for a newly-registered player. Collision-check
// mirrors gameService's generateUniqueInviteCode (API-6), just against players.invite_code
// instead of games.invite_code.
export async function assignInviteCode(db: Pool | PoolClient, playerId: number): Promise<string> {
  const maxAttempts = 5;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generateFriendInviteCode();
    const { rows } = await db.query('SELECT 1 FROM players WHERE invite_code = $1', [code]);
    if (rows.length === 0) {
      await db.query('UPDATE players SET invite_code = $1 WHERE id = $2', [code, playerId]);
      return code;
    }
  }
  throw new Error(`failed to generate a unique friend invite code after ${maxAttempts} attempts`);
}
