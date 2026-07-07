# ADR 0002: Online-game room state kept in server memory, not the database

**Status:** Accepted
**Date:** 2026-07-07

## Context

Phase 3 (real-time online multiplayer) needs to track, per online game: which Socket.io
connection is bound to which mark (X/O), each mark's reconnect token, and an active
disconnect grace-period timer. None of this has anywhere obvious to live in the existing
schema without a migration, and the schema was deliberately kept minimal in Phase 1.

## Decision

This state lives in a plain in-memory `Map<gameId, RoomState>`
(`server/src/sockets/roomState.ts`) for the life of the server process, not in Postgres.
Reconnect tokens are random UUIDs generated per mark when a room is created, handed to
each client in its `join_game` ack, and never broadcast to the other player (a broadcast
would let one player forge a reconnection as the other mark). The 30-second (default,
`DISCONNECT_GRACE_PERIOD_MS`) disconnect timer is a plain `setTimeout`.

Two related decisions made along the way:

- **Rematch reuses the live Socket.io connection, not the database row.** Spec §4.3.6 says
  "rematch re-uses the same room" — read here as the _socket_ room (the two players already
  talking to each other), not the `games` row. Accepting a rematch creates a fresh
  `games`/`game_players` row set directly at `in_progress` (both marks seated immediately,
  skipping `waiting` entirely) and moves both sockets from the old Socket.io room to the
  new one — no new HTTP round trip or re-scanning a link for two players already connected.
- **Event set is consolidated from spec §8's literal list.** The spec pairs
  `player_joined`/`opponent_left` and separately `player_disconnected`/`player_reconnected`.
  This build drops `opponent_left` as its own event: a mid-game disconnect uses
  `player_disconnected` → `player_reconnected` or `game_over` (`reason: 'forfeit'`), and a
  creator abandoning the _waiting_ room (no opponent ever joined) just flips `games.status`
  to `abandoned` — there's no one connected to notify.

## Consequences

- **A mid-game server restart (e.g. a PM2 crash-restart) loses reconnect capability for
  every game in flight.** Both sockets disconnect, the in-memory room state (including
  reconnect tokens) is gone, and neither player can resume — the game is simply stuck
  `in_progress` in the database forever (no automatic cleanup exists for this case yet).
  Acceptable for a single-instance deployment; revisit if/when the server needs to survive
  restarts mid-game, or runs as more than one instance (which would need this state moved
  to something shared, e.g. Redis, since two players' sockets could land on different
  instances behind a load balancer).
- Reconnect-after-page-refresh is only guaranteed for the _original_ game behind an invite
  code. After a mutual-accept rematch, the browser's persisted session (for refresh
  recovery) still points at the original game/invite code, not the new one — refreshing
  mid-rematch may not resume seamlessly. Solving that fully would mean the invite URL
  itself tracking the current game (real client-side routing), which is more than this
  phase needs; the client explicitly documents this limitation
  (`client/src/hooks/useOnlineGame.ts`).
- No new migration was needed for Phase 3.
