# XO Duel Implementation Plan — from spec + mockup to a full build

**Status:** Draft for review
**Last updated:** July 6, 2026
**Inputs:** `.specify/xo-duel-spec.md`, `rules.md`, the Claude Design prototype
`design/XO_Duel.dc.html`.
**Goal:** take the repo from "docs only" to the full four-mode app (local, AI,
online, plus guest/registered identity), in reviewable PR-sized phases. No
phase merges without green CI and tests (DOD-1, TEST-1).

This plan is work breakdown only — no app code is written yet.

---

## Where we are vs. where the design points

The repo currently has: `spec.md`, `rules.md`, `CLAUDE.md`, `AGENTS.md`, and
the Claude Design prototype. Nothing else exists yet — no `package.json`, no
schema, no server, no client.

The mockup is further along than a typical static design export: it's a
working interactive prototype with real client-side game logic already
correct — win/draw detection (`checkWinner`), a full minimax implementation
(`minimax`), and four differentiated AI difficulty behaviors (`getAiMove` for
`easy` / `medium` / `hard` / `impossible`). This logic should be **adapted
into `server/src/domain/`, not just used as a visual reference** — it's
already pure (no I/O) and directly satisfies ARC-1. The mockup's admin login
is hardcoded client-side (`admin` / `admin123`) purely for demo purposes and
must **not** carry over — real admin auth is argon2 + server-side session
(SEC-1, SEC-2, SEC-10).

The mockup defines 11 screens: `home`, `difficulty`, `board`,
`online-waiting`, `result`, `history`, `leaderboard`, `login`, `account`,
`admin-login`, `admin`. All 11 map directly onto the spec's feature list —
nothing in the mockup is out of scope, and nothing in scope is missing from
the mockup.

---

## Schema (initial migration)

A single first migration, since there's no prior schema to reconcile
(unlike a project with an existing walking skeleton):

- `players` — `id`, `nickname`, `session_token`, `created_at`, `last_seen_at`,
  `username` (unique, nullable), `password_hash` (nullable), `is_registered`
  (bool), `invite_code` (unique).
- `friendships` — `id`, `requester_id` (fk), `addressee_id` (fk), `status`
  (pending/accepted), `created_at`; unique on the player pair.
- `games` — `id`, `mode` (`local`/`ai`/`online`), `invite_code` (unique,
  nullable — only for `online`), `ai_difficulty` (nullable enum:
  easy/medium/hard/impossible — matches the mockup's four tiers), `status`
  (waiting/in_progress/complete/abandoned), `winner_player_id` (nullable fk),
  `created_at`, `completed_at`.
- `game_players` — `id`, `game_id` (fk), `player_id` (fk, nullable for a
  local-mode second seat with no account), `mark` (X/O), `outcome`
  (win/loss/draw, nullable while in progress).
- `moves` — `id`, `game_id` (fk), `player_id` (fk, nullable), `cell` (0–8),
  `mark` (X/O), `move_number`, `created_at`. Append-only (DB-6).
- `events` — `id`, `game_id` (nullable fk), `type`, `payload` (jsonb),
  `created_at`.
- `session` — server-side session store table (`connect-pg-simple`).

Indexes: `games(invite_code)` (online lookups), `game_players(game_id)`,
`game_players(player_id)`, `moves(game_id, move_number)`,
`friendships(requester_id, addressee_id)`. Leaderboards stay derived on read
(DB-7, API-9) — no ranking table.

---

## Design source & asset locations

- `design/XO_Duel.dc.html` (repo root) — the Claude Design source of truth,
  the exported prototype file. Treat as read-only reference, not edited
  in place.
- `client/src/styles/tokens.css` — the extracted design tokens (OKLCH color
  scale for light/dark, `--accent`, `--x-color`, `--o-color`, `--success`,
  `--danger`, `--warning`, `--border`, `--surface`, radii, shadow), the
  single styling source (ARC-3).
- `client/src/components/` — translated React components: `Board`, `Cell`,
  `DifficultyCard`, `ModeButton`, `InviteQrCard`, `RoomCodeCard`,
  `ResultBanner`, `HistoryRow`, `LeaderboardRow`, `BottomNav`, `ThemeToggle`,
  `RematchButton`.
- `client/src/assets/` — any icons/images the Vite build fingerprints.
- `client/public/` — static fixed-URL files (favicon, manifest, og-image).
- `server/src/domain/gameLogic.ts` — `checkWinner` and the win-line table,
  adapted from the mockup, pure and unit-tested (ARC-1, TEST-3).
- `server/src/domain/minimax.ts` — the minimax + per-difficulty `getAiMove`
  logic, adapted from the mockup, pure and unit-tested.

---

## Phases (each = one PR)

### Phase 1 — Foundations: tokens, schema, pure game logic

Three things that everything else depends on, bundled as one foundational
phase since none of them is independently useful until the others exist:

- **Design tokens + components:** extract `design/XO_Duel.dc.html`'s OKLCH
  tokens (light + dark) into `client/src/styles/tokens.css`; wire the
  Manrope (body) + Space Grotesk (display) font pairing; build the shared
  components the screens reuse (`Board`, `Cell`, `ModeButton`,
  `DifficultyCard`, `ResultBanner`, `LeaderboardRow`, `HistoryRow`,
  `BottomNav`, `ThemeToggle`, `RematchButton`). ARC-3: components consume
  tokens only. ARC-3a: theme toggle drives `[data-theme]`, persisted,
  defaulting to `prefers-color-scheme`.
- **Schema + migrations:** the initial migration (schema above) via
  `node-pg-migrate` — `players`, `friendships`, `games`, `game_players`,
  `moves`, `events`, `session`.
- **Pure game logic:** port `checkWinner` and the win-line table into
  `server/src/domain/gameLogic.ts`; port `minimax` and the four
  `getAiMove` difficulty behaviors into `server/src/domain/minimax.ts`. No
  I/O in either file (ARC-1).

**Verify:** a component-gallery preview page + a Playwright screenshot in
both light and dark theme; migration up/down clean on a scratch database;
unit tests covering a horizontal/vertical/diagonal win, a full-board draw,
an in-progress board (TEST-3), and proof that the `impossible` AI tier never
loses from any reachable board state.

### Phase 2 — Local play and AI opponent, end to end

- **Local 2-player:** `POST /api/games` (`mode: 'local'`), move submission
  validated server-side using Phase 1's `checkWinner`, `POST
  /api/games/:id/complete`. Frontend: home/mode-select → local board →
  result (win/loss/draw) → Rematch. No account required (API-7).
- **AI opponent:** `POST /api/games` (`mode: 'ai'`, `ai_difficulty`), AI
  move computed server-side using Phase 1's `minimax`/`getAiMove` — never
  trust a client-submitted AI move. Frontend: difficulty-select screen
  (four cards: Easy/Medium/Hard/Impossible, matching the mockup) → board →
  result → Rematch.

**Verify:** supertest for game creation + move submission for both modes
(including rejecting an out-of-turn or illegal move, and confirming the
server — not the client — computes every AI move); Playwright "start local
game → play to a win → see result → tap Rematch → new board appears" and
"pick Impossible → play a full game → result is a win or a draw, never a
loss."

### Phase 3 — Real-time online multiplayer

`server/src/sockets/` — game room lifecycle: `join_game` (by invite code),
`make_move` (validated server-side against the authoritative board —
ARC-5), `move_made`, `game_over`, `player_disconnected` /
`player_reconnected` (with a grace-period timer before auto-forfeit — exact
duration is an open decision, see below), `request_rematch` /
`rematch_accepted`. Invite codes: single-use once two players have joined,
high-entropy (API-5, API-6), no login required to create or join (API-7).
Frontend: mode-select → online "waiting for opponent" screen with the
QR/room-code card (mirroring the mockup's `RoomCodeCard`/QR generation, now
wired to a real invite link) → live board → result → Rematch (requires the
other player to accept, per the open decision below) or a "find new
opponent" option.

**Verify:** Socket.io integration tests (two connected test clients) for
join, a full game to completion, rejecting an illegal/out-of-turn move over
the socket, disconnect → grace-period → auto-forfeit, and the rematch
handshake; Playwright test driving two browser contexts through a full
online game.

### Phase 4 — Accounts

`POST /api/auth/register` (upgrades the current guest player row in place —
no data loss), `POST /api/auth/login`, `POST /api/auth/logout`, `GET
/api/auth/me`, all argon2-backed (SEC-1, SEC-3). Frontend: login/register
screen (mirroring the mockup's `login` screen — username/password/confirm
with the mockup's validation shape, but wired to the real API instead of
`setState`), account screen showing guest-vs-registered status.

**Verify:** supertest covering register/login/logout/rate-limiting on
login; Playwright "play as guest → register mid-session → history from
that session is retained under the new account."

### Phase 5 — Friends, leaderboards, and admin dashboard

Grouped together because they're all read-layers over the same completed
game data, built once accounts exist:

- **Friends + leaderboards:** `GET/POST /api/friends*` (search, request,
  accept/decline, invite link), `GET /api/friends/leaderboard`, `GET
  /api/leaderboard/global` — both **derived on read** from
  `game_players`/`moves`, scoped to `mode = 'online'` between two
  registered players only (API-9, DB-7); a guest's side of a match never
  persists to either leaderboard. Frontend: friends list + requests,
  leaderboard screen with the mockup's two tabs (Friends/Global).
- **Admin dashboard:** real admin auth — `ADMIN_USERNAME` +
  `ADMIN_PASSWORD_HASH` from env, argon2, Postgres-backed session
  (`connect-pg-simple`), rate-limited login — this **replaces** the
  mockup's hardcoded client-side check entirely, it is not reused in any
  form. `GET /api/admin/stats` (active players, games in progress,
  games-over-time, outcome distribution — read from `events`, OBS-3) and
  `GET /api/admin/players`. Read-only in v1 (SEC-10). Frontend: admin login
  + dashboard screens (mirroring the mockup's `admin-login`/`admin`
  screens, now real).

**Verify:** integration tests for the friend-request flow and for
leaderboard derivation (correct ordering, ties, and that local/AI games and
guest-side results never appear); supertest confirming every admin route
401s without a valid admin session and 200s with one; Playwright "two
registered accounts play an online game → both see it reflected on the
global leaderboard" and "admin logs in → sees live player/game counts."

### Phase 6 — Deploy

Nginx reverse-proxy config (including WebSocket upgrade headers for
Socket.io), PM2 process file, Hetzner VPS setup steps, Cloudflare DNS/SSL
pointed at the VPS, Vercel deploy for `client/`, a runbook
(`docs/runbook.md`) for deploy/restart/logs/rollback.

**Verify:** live domain reachable off-network; a full online game played
end to end between two real devices through the deployed stack; health
check endpoint green.

---

## Cross-cutting

- **Real-time discipline (replaces "polling discipline" from a turn-based
  reference model):** online-game state changes are pushed via Socket.io as
  they happen (API-8) — never polled. Settle the disconnect/reconnect
  grace-period duration early in Phase 3, since it affects both the socket
  server and the frontend's "opponent disconnected" UI state.
- **Server-authoritative play (ARC-5):** true from Phase 2 onward, not just
  Phase 3 — even local and AI moves are validated server-side, not just
  trusted from the client, so cheating/bugs can't slip in via a modified
  frontend.
- Coverage stays ≥ 80% every phase (TEST-2); game logic and AI stay pure
  where possible (ARC-1).
- Observability (OBS-1/2): structured JSON logging from Phase 1 onward, with
  every relevant log line carrying a `gameId` — including across a
  disconnect/reconnect in Phase 3.
- Playwright runs in CI on every PR + push (CI-2, TEST-4), report/traces
  uploaded as artifacts.
- Each phase is a branch → PR → green CI + 8-layer review → squash-merge
  (GIT-6/7). `main` is protected (REPO-2).
- Field alignment with the mockup: invite codes are `XO-XXXXX` format
  (`XO-` prefix + 5 chars from an alphabet excluding ambiguous characters —
  matches `makeSeedForRoom()`'s pattern); AI difficulty tiers are exactly
  `easy` / `medium` / `hard` / `impossible` (not a different count or
  naming).

---

## Open decisions to settle before the phase they block

- **Local/AI starting order:** mockup always starts with Player 1 = X moving
  first, no alternation on rematch. Confirm this before Phase 2, or decide
  to add alternation.
- **Online disconnect grace period:** exact timeout before auto-forfeit
  (e.g. 30s / 60s) — blocks Phase 3.
- **Online rematch:** mutual-accept (both players confirm) vs. immediate
  restart if both are still connected — blocks Phase 3.
- **Leaderboard ranking formula:** the mockup's mock data uses a `points`
  field (rank ordered by points, not raw win count) — decide the actual
  formula (e.g. win=3/draw=1/loss=0, or straight win-rate with a
  minimum-games threshold) before Phase 5.
- **Guest online games:** confirmed not persisted to leaderboard/history for
  the guest's side (API-9) — confirm the UI nudge ("sign up to save this")
  is in scope for Phase 3/4 or deferred.
- **Backend deploy mechanism:** GitHub Actions SSH-deploy step vs. a
  pull+PM2-reload script on the VPS — decide before Phase 6.
