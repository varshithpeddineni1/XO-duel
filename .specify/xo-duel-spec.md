# XO Duel — Specification (v1)

**Status:** Draft
**Last updated:** July 6, 2026
**Tagline:** Challenge anyone. Anywhere. Anytime.
**Scope:** A fully featured online Tic Tac Toe web app. Four ways to play (local
2-player, single player vs AI, online multiplayer, and — implicitly — guest or
registered), with accounts, friends, a friend leaderboard, a global leaderboard,
game history, and an admin view into who's playing.

---

## 1. Overview

XO Duel is a web-based Tic Tac Toe game. Players can jump in instantly as a
guest or register an account to unlock history and leaderboards. Four ways to
play:

- **Local 2-player** — two people, one device, one browser tab.
- **Single player vs AI** — a minimax-based computer opponent with selectable
  difficulty.
- **Online multiplayer** — real-time, cross-device play over WebSockets
  (Socket.io), joined by an invite link or QR code.
- (Guest play and registered-account play are identity modes that apply across
  all of the above, not a separate game mode.)

The backend is a Node.js + Express + TypeScript API backed by PostgreSQL,
deployed on a Hetzner VPS behind Nginx and Cloudflare (DNS + SSL). The frontend
is React + TypeScript + Vite, deployed to Vercel. Real-time play is handled by
Socket.io rooms, not polling — this is XO Duel's key architectural difference
from turn-based reference projects, since simultaneous online play is a
first-class goal here.

---

## 2. Goals and non-goals

### Goals (v1)

- Anyone can **play as a guest** — no login required — for any mode.
- A player **may optionally register** (username + password via argon2),
  upgrading their existing guest identity in place so history is preserved.
- **Local 2-player**: two players share one device and one screen.
- **Single player vs AI**: a minimax opponent, selectable difficulty.
- **Online multiplayer**: real-time play against another human, anywhere,
  matched via a shareable invite link or a scannable QR code.
- **Game history** for logged-in users: past games, opponents, results.
- **Friend leaderboard**: standings among a player and their accepted friends.
- **Global leaderboard**: ranked standings across all registered players.
- **Rematch**: replay the same opponent (local, AI, or online) without
  re-setting-up the game.
- **Light/dark theme**, token-driven, persisted, defaulting to OS preference.
- **Admin view**: a single admin can see who is playing — active players,
  games in progress, and aggregate stats. Read-only observability, not
  question/content curation (there's no content to curate in Tic Tac Toe).

### Non-goals (deferred to a later phase)

- Spectator mode (watching someone else's live game).
- In-game chat.
- Tournaments / brackets / scheduled competitions.
- Native mobile apps (this is a mobile-friendly web app).
- Social login / OAuth / email-based auth — accounts are username + password
  only in v1.
- Matchmaking queue ("play a random online opponent") — v1 online play is
  invite-link/QR only, played with a specific person. A "quick match" queue is
  a candidate future phase (see §12).
- ELO/rating-based leaderboard — v1 leaderboards rank by win count / win rate
  (see §7 scoring), not a rating algorithm. ELO is a candidate future phase.
- Admin moderation (ban/suspend accounts) — v1 admin is observability-only.

---

## 3. Users and roles

| Role                  | Auth                              | Capabilities |
| --------------------- | ---------------------------------- | ------------ |
| **Guest player**      | None (nickname + browser session)  | Play any mode (local, AI, online); create/join an online game by link or QR; see their own in-session result. No history persists across sessions, no leaderboard entry. |
| **Registered player** | Username + argon2 password         | Everything a guest can, plus: persistent game history, friends, friend leaderboard, global leaderboard entry, cross-device play under the same account. |
| **Admin**             | Username + argon2 password (single) | View all players (guest + registered), live/active game count, games-played-over-time, win/loss/draw distribution, mode split (local/AI/online). Read-only. |

There are **three auth roles**. A guest is a nickname + a browser-session
cookie. Registering upgrades that same underlying player row in place (sets
`username`, `password_hash`, `is_registered`), preserving any in-session
history for that browser going forward. The admin is a single, env-configured
account — the same pattern as a typical single-admin analytics setup: no admin
self-registration, credentials from environment variables only.

---

## 4. Gameplay

### 4.1 Local 2-player

1. Two players share one device. Player 1 is always X, Player 2 is always O
   (assumption — see §11 open decisions on alternating starter).
2. Players tap/click cells in turn; the board enforces turn order and blocks
   taken cells.
3. Game ends in a win (3 in a row/column/diagonal) or a **draw** (board full,
   no winner).
4. Result screen shows the outcome and offers **Rematch** (same two players,
   fresh board) or **New Game** (back to mode select).

### 4.2 Single player vs AI

1. Player picks a difficulty before starting.
2. The AI uses **minimax** (with alpha-beta pruning) for its "hard/unbeatable"
   tier; lower tiers intentionally play suboptimally some percentage of the
   time so a human can actually win.
3. Player is always X and moves first (assumption).
4. Same win/draw detection and result screen as local play, plus **Rematch**.
5. If the player is registered, the result is recorded to their game history
   (AI games do not count toward the global/friend leaderboard — those are
   human-vs-human by definition; see §7).

### 4.3 Online multiplayer

Real-time play over Socket.io, joined by invite link or QR code — not
matchmaking in v1.

1. Player A starts an online game and gets a **shareable invite link** and a
   **QR code** encoding that link.
2. Player A lands on a "waiting for opponent" screen; the server holds an open
   game room.
3. Player B opens the link (or scans the QR), optionally enters a nickname if
   a guest, and joins the room.
4. Once both players are connected, the game starts. Moves are sent over the
   socket and **validated server-side** — the server is authoritative on turn
   order, cell occupancy, and win/draw detection. The client never determines
   game-over state on its own.
5. Both players see moves appear in real time as they happen.
6. On win/draw, both clients receive the final result simultaneously from the
   server. **Rematch** re-uses the same room; a rematch request must be
   accepted by the other player before a new board starts (assumption).
7. **Disconnect handling:** if a player disconnects mid-game, the game is
   marked paused and the other player is notified; if the disconnected player
   doesn't reconnect within a grace period, the game is auto-forfeited in
   favor of the connected player (assumption — see §11 for the exact timeout).
8. If both players are registered accounts, the result is written to both
   players' game history and counts toward the global and friend leaderboards.
   If either player is a guest, the result still displays in-session but is
   **not** persisted to history/leaderboards for the guest side (a registered
   opponent's own history/leaderboard entry is still recorded for their side).

### 4.4 Scoring and results

- **Win**: 3 in a row (row, column, or diagonal) for one player.
- **Draw**: all 9 cells filled, no winning line for either player. Draws are a
  fully expected outcome — with perfect play, every game of Tic Tac Toe ends in
  a draw, so the unbeatable AI tier is expected to draw against a skilled human
  rather than lose.
- **Loss**: the other player wins.
- Every completed game records exactly one outcome per player: `win`, `loss`,
  or `draw`. Leaderboards and history track all three, not just wins.

---

## 5. AI opponent (minimax)

- Core algorithm: **minimax** with alpha-beta pruning, evaluating the full
  game tree (Tic Tac Toe's search space is small enough to solve exhaustively
  at every turn — no heuristic evaluation function is needed for the top
  tier).
- **Difficulty tiers** (assumption, open to adjustment — see §11):
  - **Easy** — AI makes a largely random legal move.
  - **Medium** — AI plays minimax most of the time, but occasionally
    (probabilistically) plays a random legal move instead.
  - **Hard / Unbeatable** — AI always plays the minimax-optimal move; a human
    can at best draw.
- AI logic is **pure and unit-testable** — no I/O, deterministic given a board
  state and difficulty, so it can be fully covered by unit tests without a
  server or database (mirrors ARC-1-style architecture rules).

---

## 6. Architecture and tech stack

```
[ Player browser (React + TS SPA, Vercel) ]
            |
        HTTPS + WSS
            |
   [ Cloudflare: DNS + SSL/TLS ]
            |
   [ Nginx reverse proxy (Hetzner VPS) ]
            |
   [ Node.js + Express + Socket.io API (PM2-managed) ]
            |
      [ PostgreSQL ]
 (players, games, moves, friendships, events)
```

### Components

- **Frontend:** React + TypeScript + Vite. Deployed to Vercel. Mobile-first,
  responsive board. Screens: home/mode-select, local game, AI setup + game,
  online invite/waiting, online game, result, history, leaderboards
  (friend + global), admin dashboard.
- **Backend:** Node.js + Express, TypeScript. REST for account/session/
  history/leaderboard reads; **Socket.io** for real-time online-game state
  (moves, presence, disconnect/reconnect, rematch requests).
- **Database:** PostgreSQL, already installed on the Hetzner VPS.
- **Auth:** `express-session` + `argon2` for both player accounts and the
  single admin account.
- **Process management:** PM2 on the Hetzner VPS so the API + Socket.io server
  restart on crash/reboot.
- **Exposure:** Nginx reverse-proxies to the Node process (including
  WebSocket upgrade headers for Socket.io); Cloudflare provides DNS and free
  SSL/TLS in front of Nginx.

### Why WebSockets here (unlike a turn-based reference project)

Online multiplayer in XO Duel is genuinely simultaneous and real-time — both
players are online together, moves must appear instantly, and a "waiting for
opponent" / live board state needs push updates, not client polling. Socket.io
rooms (one room per online game) are the natural fit: the server holds
authoritative game state per room, validates every move, and pushes updates to
both connected sockets.

---

## 7. Data model (initial sketch)

> Indicative, not final — refine during the schema build via versioned
> migrations (`node-pg-migrate`, snake_case names).

**players** — `id` (pk), `nickname`, `session_token`, `created_at`,
`last_seen_at`. Account columns: `username` (unique, nullable — null = guest),
`password_hash` (argon2, nullable), `is_registered` (bool), `invite_code`
(unique, for friend invite links). A registered player is the same row
upgraded in place, preserving `games`/`game_players` history.

**friendships** — `id` (pk), `requester_id` (fk players), `addressee_id` (fk
players), `status` (pending / accepted), `created_at`; unique on the player
pair, symmetric once accepted.

**games** — `id` (pk), `mode` (`local` / `ai` / `online`), `invite_code`
(unique, for online games), `ai_difficulty` (nullable; only for `ai` mode),
`status` (`waiting` / `in_progress` / `complete` / `abandoned`),
`winner_player_id` (nullable fk — null for a draw or in-progress),
`created_at`, `completed_at`.

**game_players** — `id` (pk), `game_id` (fk), `player_id` (fk, nullable for a
local-mode "player 2" with no account), `mark` (`X` / `O`), `outcome` (`win` /
`loss` / `draw` / nullable while in progress).

**moves** — `id` (pk), `game_id` (fk), `player_id` (fk, nullable), `cell`
(0–8), `mark` (`X` / `O`), `move_number`, `created_at`. The authoritative,
ordered move log the server validates against and can replay for history/
review.

**events** — `id` (pk), `game_id` (nullable fk), `type` (e.g.
`game_created`, `player_joined`, `player_disconnected`, `game_completed`),
`payload` (jsonb), `created_at` — audit trail the admin dashboard reads.

**session** — server-side session store (e.g. `connect-pg-simple`), holding
the signed session payload (player identity, admin elevation).

The **global leaderboard** and **friend leaderboard** are **derived on read**
from `game_players` (scoped to `mode = 'online'`, since local/AI results are
personal, not competitive rankings) — not stored as denormalized ranking rows.
Ranking metric: win count / win rate (see §11 open decision on the exact
formula and minimum-games threshold).

---

## 8. API surface (initial sketch)

> Indicative. Admin routes are auth-gated. Real-time game play uses Socket.io
> events, not REST, once a game is in progress.

**Session (guest)**

- `POST /api/session` — set/update nickname, issue a session (guest play).
- `GET /api/me` — current player info (guest or registered).

**Accounts**

- `POST /api/auth/register` — username + password; upgrades the current
  player row in place.
- `POST /api/auth/login` — username + password (rate-limited).
- `POST /api/auth/logout`.
- `GET /api/auth/me` — registered-account info.

**Friends**

- `GET /api/friends` — accepted friends; `GET /api/friends/requests` —
  pending.
- `GET /api/friends/search?q=` — find players by username.
- `POST /api/friends/requests` — send a request; `POST
  /api/friends/requests/:id/accept` | `/decline`.
- `POST /api/friends/invite/:code` — accept a friend invite link.
- `GET /api/friends/leaderboard` — derived, scoped to me + friends.

**Games (REST — setup and history)**

- `POST /api/games` — create a game (`mode`, `ai_difficulty` if applicable);
  returns the game + `invite_code` for online mode.
- `GET /api/games/:code` — look up an online game by invite code (to join).
- `GET /api/games/history` — the current player's completed games.
- `GET /api/leaderboard/global` — derived global standings.

**Games (Socket.io — real-time online play)**

- `join_game` (client → server): join a game room by invite code.
- `player_joined` / `opponent_left` (server → clients): presence updates.
- `make_move` (client → server): attempt a move at a cell; server validates.
- `move_made` (server → clients): broadcasts the validated move + updated
  board state.
- `game_over` (server → clients): final result (`win` + winner, or `draw`).
- `request_rematch` / `rematch_accepted` (bidirectional): rematch flow.
- `player_disconnected` / `player_reconnected` (server → clients): connection
  status during the grace period (see §11).

**Admin (auth required)**

- `POST /api/admin/login`, `POST /api/admin/logout`.
- `GET /api/admin/stats` — active players, games in progress, games over
  time, win/loss/draw distribution, mode split.
- `GET /api/admin/players` — list of players (guest + registered), last seen.

QR codes are generated client-side from the invite link (no server endpoint
needed).

---

## 9. Look and feel

- **Light/dark theme**: token-driven (CSS custom properties), toggled via a
  `[data-theme]` attribute, persisted, defaulting to OS
  `prefers-color-scheme`. No component hard-codes a color value.
- **Rematch button**: present on every result screen (local, AI, online),
  re-launching the same matchup without returning to mode-select.
- Mobile-first, responsive board — playable one-handed on a phone.

---

## 10. Hosting and deployment notes

- **Server:** Hetzner CX23 (Helsinki), Ubuntu 24.04, Node.js v20.20.2,
  PostgreSQL 18.4, Nginx 1.28.3, PM2.
- **Reverse proxy:** Nginx terminates HTTP(S) from Cloudflare and proxies to
  the local Node/Socket.io process, including WebSocket upgrade headers.
- **DNS/SSL:** Cloudflare (free tier) — proxies the domain to the Hetzner IP,
  provides SSL/TLS.
- **Frontend hosting:** Vercel, built from the same monorepo's `client/`
  workspace.
- **Process management:** PM2 keeps the API + Socket.io server running across
  crashes and reboots.
- **Backend deploy:** GitHub Actions builds and deploys to the Hetzner VPS on
  merge to `main` (exact mechanism — SSH deploy step vs a pull-based script —
  is an open decision, §11).

---

## 11. Open decisions

- **Local 2-player starting order:** always X first, or alternate who starts
  on rematch? (Assumption above: fixed X-first. Easy to change.)
- **AI first move:** player always moves first, or alternate? (Assumption
  above: player always X, moves first.)
- **AI difficulty tiers:** exact count and behavior (assumption above: Easy /
  Medium / Hard-Unbeatable, three tiers) — could expand to four.
- **Online disconnect grace period:** exact timeout before auto-forfeit (e.g.
  30s? 60s?) and whether a paused game can be resumed later or must be
  forfeited immediately.
- **Online rematch:** does it require explicit mutual accept, or does
  requesting a rematch immediately start a new board if the other player is
  still connected?
- **Leaderboard ranking formula:** raw win count, win rate (%) with a minimum
  games-played threshold to qualify, or something else. No ELO in v1 (§2).
- **Guest online games:** confirmed not persisted to leaderboard/history for
  the guest side — confirm this is the intended behavior.
- **Backend deploy mechanism:** GitHub Actions SSH-deploy step vs. a
  self-hosted runner vs. a pull + PM2-reload script on the VPS.

---

## 12. Future phases (post-v1)

- **Matchmaking queue** — "quick match" against a random online opponent,
  instead of invite-link/QR only.
- **ELO-style rating** for the global leaderboard, replacing/augmenting simple
  win-rate ranking.
- **Spectator mode** and **in-game chat**.
- **Admin moderation** — suspend/ban an account, not just observe.
- **PWA / installable** client with an offline-capable app shell.
- **Tournaments / brackets.**

---

## 13. Suggested build order

1. **Design tokens + component library** (light/dark theme system, board
   component) — after Claude Design mockups.
2. **Postgres schema (v1) + migrations** — players, games, game_players,
   moves, events, friendships, session.
3. **Core REST API** — sessions, account register/login, game creation,
   history, leaderboard reads.
4. **Pure game logic** — win/draw detection, minimax AI (fully unit-tested,
   no I/O).
5. **Local 2-player frontend** (setup → play → result → rematch).
6. **AI opponent frontend** (difficulty select → play → result → rematch).
7. **Socket.io real-time layer** — game rooms, move validation, disconnect/
   reconnect, rematch flow.
8. **Online multiplayer frontend** — invite/QR generation, join flow, live
   board, result, rematch.
9. **Friends + leaderboards** (friend requests, friend leaderboard, global
   leaderboard).
10. **Admin dashboard** — player list, stats, read-only.
11. **Deploy** — Hetzner (backend) + Vercel (frontend) + Cloudflare
    (DNS/SSL).

---

## Attribution

No third-party content is used; all game logic and content are original to
this project.
