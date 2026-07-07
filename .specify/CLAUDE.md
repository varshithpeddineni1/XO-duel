# CLAUDE.md

Guidance for Claude Code (and any AI agent) working in this repo. The binding
rules live in [`rules.md`](./rules.md); the feature spec is in
[`.specify/xo-duel-spec.md`](./.specify/xo-duel-spec.md). Read both before
non-trivial work (AGENT-1).

## What this is

XO Duel: a full-stack online Tic Tac Toe game. Node + Express + Socket.io API,
Postgres, React + Vite SPA, hosted on a Hetzner VPS (backend, behind Nginx —
TLS via Certbot/Let's Encrypt for the DuckDNS hostname `xoduel.duckdns.org`)
and Vercel (frontend, `xoduel.vercel.app`). Guest play works for every mode,
including online multiplayer — no login wall anywhere (API-7). Accounts are
an optional upgrade for history, friends, and leaderboards.

## Build, test, run

```bash
npm install
npm run dev --workspace server     # API + Socket.io  http://localhost:3000
npm run dev --workspace client     # SPA              http://localhost:5173
npm run migrate                    # apply DB migrations
npm test                           # Vitest unit + coverage (gate >=80%, no DB)
npm run test:integration --workspace server  # supertest + socket.io-client vs Postgres (needs DATABASE_URL)
npm run lint && npm run typecheck  # ESLint + tsc
npm run test:e2e                   # Playwright (full stack: API + client preview)
docker-compose up                  # full local stack
```

## Working agreement

- **Plan first.** For any non-trivial change, read the spec and present a
  plan before editing (AGENT-1, AGENT-2).
- **Tests before or with code** (TEST-1). Keep coverage >= 80% (DOD-1).
- **Verify, don't assert.** Show command output or a test result; never claim
  success without evidence (DOD-2). UI work needs a Playwright screenshot
  before it is "done" (AGENT-3, DOD-3).
- **Thin handlers, pure logic.** Business logic lives in
  `server/src/services`; win/draw detection and the minimax AI stay pure in
  `server/src/domain`, with no I/O (ARC-1, ARC-2).
- **Server is authoritative.** No client-side determination of turn order,
  move legality, or game-over state — ever (ARC-5). This applies even though
  guests can create and join games without an account.
- **Real-time means sockets, not polling.** Online-game moves, presence, and
  results are pushed via Socket.io as they happen (API-8).
- **Invite codes are single-use and high-entropy** (API-5, API-6) — never
  reusable, never guessable.
- **Schema only via migrations** in `server/migrations` (DB-2).
- **No secrets in code or logs** (SEC-1, OBS-1). Config comes from env
  (CODE-3).
- **Conventional Commits**, branch from an issue, squash-merge via PR
  (GIT-1, GIT-3, GIT-6, GIT-7).

## Layout

```
server/   Express + Socket.io API (src/{routes,sockets,services,domain,middleware,schemas,db,config,lib})
client/   React + Vite SPA (src/{pages,components,api,styles,theme})
e2e/      Playwright critical-flow tests
scripts/  hash-admin, pr-review
docs/     runbook, ADRs
```

## Current state

> **Keep this section current.** Whenever a pull request completes a
> milestone from the spec's suggested build order (or meaningfully changes
> what's built), rewrite this section in that same PR (DOD-4, AGENT-4) —
> concretely, not vaguely: name which endpoints/socket events exist, which
> are still stubbed, and which Playwright test is expected to still fail, if
> any. Do not leave this paragraph describing a stale state.

**Phase 1 (foundations) landed.** npm workspaces (`server`, `client`, `e2e`), shared root
ESLint/Prettier, `.env.example`, the initial Postgres migration (`players`, `friendships`,
`games`, `game_players`, `moves`, `events`, `session`), pure/unit-tested domain logic
(`gameLogic.ts`, `minimax.ts`), and design tokens (`client/src/styles/tokens.css`, OKLCH,
`[data-theme]`). `ci.yml` + `pr-review.yml` wired up.

**Phase 2 (local play + AI opponent, end to end) landed.** Real REST API, server-
authoritative (ARC-5): `POST /api/games` (`mode: 'local'` or `mode: 'ai'` +
`aiDifficulty`), `GET /api/games/:id`, `POST /api/games/:id/moves` (body `{ cell, mark }` —
rejects wrong-turn/occupied/out-of-range moves and any client-submitted `mark: 'O'` in
ai-mode; computes the AI's reply server-side in the same request via Phase 1's
`getAiMove`). Board state is derived by replaying `moves` (`server/src/domain/board.ts`) —
no `board` column exists. Finalization (outcome per `game_players`, `events` row) happens
inline in the moves handler, not via a separate `/complete` endpoint. Validated with zod
(`server/src/schemas/gameSchemas.ts`), rate-limited on creation (API-10), documented via
an OpenAPI doc served at `/api/docs` in non-production (API-1). All 11 unit tests for the
new schema/board logic plus 34 total server unit tests pass at ~97% coverage; a
Postgres-backed integration suite (`games.integration.test.ts`, run via
`npm run test:integration`, new `integration` CI job) covers the endpoints end to end,
including a full "impossible" playthrough that never loses.

Frontend: `App.tsx` is now a real screen state machine (home → difficulty → board →
result), wired to the API. New components: `ModeButton`, `DifficultyCard`, `Board`/`Cell`
(each cell has an accessible `aria-label` now), `ScoreTile`, `ResultBanner`,
`RematchButton`, `ThemeToggle`. `theme.ts` moved to `theme/index.ts` to match CLAUDE.md's
declared layout. Two new Playwright specs (`local-game.spec.ts`, `ai-game.spec.ts`) drive
the real flows through client+server+Postgres — the `e2e` CI job now also runs the built
API server (Playwright `webServer` array) against the same Postgres service container as
`integration`. I could not run these two new e2e specs or the integration suite locally
(no Postgres/Docker available in this environment) — CI is the real verification for both,
same as Phase 1's migration check.

**Phase 3 (real-time online multiplayer) landed.** `server/src/sockets/` (Socket.io,
attached via a new `createServer()` in `index.ts` that wraps `createApp()` in a plain
`http.Server` — `createApp()` itself is unchanged, still used by REST-only supertest):
`join_game` (by invite code, binds a socket to X or O, or reconnects a disconnected mark
via a token), `make_move` (same `checkWinner`/board-replay rules as REST, keyed by
socket→mark), `game_over` (`reason: 'completed' | 'forfeit'`), `player_disconnected` /
`player_reconnected` (30s grace period, `DISCONNECT_GRACE_PERIOD_MS`), and the mutual-accept
rematch handshake (`request_rematch` / `rematch_requested` / `accept_rematch` /
`decline_rematch` / `rematch_accepted`). `POST /api/games` now also accepts
`mode: 'online'` (creates a `waiting` game, one seat filled, real invite code — API-6); new
`GET /api/games/invite/:code` for pre-join validation. Room state (socket↔mark bindings,
reconnect tokens, the grace-period timer) is deliberately **in server memory, not the
database** — see `docs/adr/0002-online-room-state.md` for why and its one real limitation
(a mid-game server restart loses reconnect capability for games in flight). A
Postgres-backed Socket.io integration suite
(`server/src/sockets/gameSocket.integration.test.ts`) covers join, a full game, illegal/
out-of-turn move rejection, disconnect→forfeit, reconnect, and both rematch outcomes.

Frontend: Home's Online Multiplayer card is wired up; `OnlineWaiting.tsx` shows the room
code and a **real, scannable QR code** (`qrcode` package — the mockup's own QR was
decorative/fake); `useOnlineGame.ts` owns the Socket.io connection and persists a reconnect
token in `sessionStorage`. `GameScreen`/`Result` (Phase 2) gained an
opponent-disconnected banner and mutual-accept rematch UI respectively, reused as-is
otherwise. New Playwright spec `online-game.spec.ts` drives **two browser contexts**
through create → join → full game → mutual rematch, and a separate disconnect→forfeit
flow. As with Phase 2, I could not run the new integration suite or e2e spec locally (no
Postgres/Docker in this environment) — CI is the real evidence.

**Phase 4 (accounts) landed.** Every visitor now gets a session (`express-session` +
`connect-pg-simple`, against the `session` table migrated back in Phase 1 for exactly this):
`POST /api/session` (creates or resumes a guest `players` row, no login required — API-7),
`GET /api/me` (current player, `null` if no session yet). Registering is an in-place
upgrade, not a new row: `POST /api/auth/register` (`username`/`password`, argon2 — SEC-1)
sets `username`/`password_hash`/`is_registered` on the *same* row a guest already had,
so anything already attributed to it is retained automatically. `POST /api/auth/login`
(regenerates the session id first, to prevent session fixation) and `POST /api/auth/logout`
round it out; login/register are both rate-limited tighter than game creation
(`server/src/routes/auth.ts` — API-10). `POST /api/games` now attributes `game_players.
player_id` to the human seat for local/AI modes via `req.session.playerId` — **online
games still don't**, since that needs sharing the session middleware with the Socket.io
layer, which is a real gap this phase left open (not one of its named deliverables, and
not needed to prove guest→registered retention, which is provable via local/AI play alone).
`server/src/services/playerService.ts` also computes aggregate win/loss/draw stats
(`GROUP BY outcome` over `game_players`) — there is no per-game history endpoint or table
yet, that's Phase 5's `HistoryRow`/`GET /api/games/history` job.

Frontend: `AppHeader` (extracted from Home's old inline header, now shared with the new
`Account` screen), `BottomNav` (Home + Account tabs only — History/Leaderboard tabs are
added in Phase 5 once those destinations exist), `Login` (username/password/confirm,
toggles between login and register), `Account` (guest-vs-registered status, W/D/L stat
tiles once registered). `App.tsx` silently calls `POST /api/session` + `GET /api/me` once
on mount to hydrate the current player. New Playwright spec `account.spec.ts`: guest plays
a local game to a win, registers mid-session, confirms the *same* win count is retained
(not reset to 0), logs out, logs back in with the same credentials. As with every phase so
far, I could not run the new integration suite or e2e spec locally (no Postgres/Docker in
this environment) — CI is the real evidence.

**Phase 5 (friends, leaderboards, history, admin dashboard) landed.** Fixed a real gap
Phase 4 had left open: online games never attributed `game_players.player_id` because a
Socket.io connection didn't share the Express session. `server/src/index.ts`'s
`createServer()` now creates one `express-session` instance and hands it to *both*
`createApp()` and `io.engine.use(sessionMiddleware)`, so `socket.request.session` (cast
through `express.Request` — `@types/express-session` augments `Express.Request`, not
`http.IncomingMessage`, which is what `socket.request` is actually typed as) sees the same
identity a REST call from that browser tab would. `createOnlineGame`/`joinOnlineGame`/
`createRematchGame` all take the resulting player id now — without this, the leaderboard
below would have stayed permanently empty for every online game.

- **History**: `GET /api/games/history` (mode-filterable), registered-only by construction
  (`requireRegisteredPlayer` — there's no stable id to query a guest's history by, so
  API-9's "no persistent history for a guest" isn't a special case, just a natural
  consequence). `client/src/pages/History.tsx` — filter pills, win/loss/draw result badges.
- **Leaderboards**: `GET /api/leaderboard/global`, `GET /api/friends/leaderboard` — derived
  on read (DB-7) from `game_players`, scoped to `mode = 'online'` games where *neither*
  seat is null (API-9: excludes local/AI by the mode filter, excludes any game with a guest
  on either side by construction). **Ranking formula (was an open spec decision): win
  rate, minimum 5 qualifying games** — below that a player just doesn't appear yet.
  `client/src/pages/Leaderboard.tsx` — Friends/Global tabs, rank coloring, "isMe"
  highlighting.
- **Friends**: `server/src/services/friendService.ts` — search, request/accept/decline,
  and a permanent personal invite code (`players.invite_code`, generated at registration,
  `FR-` prefix so it can't be confused with a game's `XO-` code) for one-step instant-accept
  invites. The `friendships` table's unique constraint only covers the *ordered*
  (requester, addressee) pair, so `sendFriendRequest` checks both orderings itself — a
  mutual request (both sides ask each other) auto-accepts instead of creating a duplicate
  row. No dedicated Friends screen existed in the mockup to adapt — `client/src/pages/
  Friends.tsx` (search, pending requests, invite-link sharing) was designed from scratch,
  reachable from the Leaderboard's Friends tab, not a new BottomNav destination.
- **Admin dashboard**: real auth (`server/src/routes/admin.ts`, `req.session.isAdmin`,
  `requireAdmin` middleware) — replaces the mockup's hardcoded client-side check entirely,
  reused none of it (SEC-2, SEC-10 — read-only, no mutation routes exist).
  `GET /api/admin/stats` reads `events` for the genuinely historical metrics (games over
  the last 7 days, outcome distribution — OBS-3) but reads `players`/`games` directly for
  the two current-state snapshots (active players, games in progress) rather than trying
  to reconstruct live state from an event log. `GET /api/admin/players` lists everyone,
  guest and registered. Frontend `AdminLogin`/`AdminDashboard` also have no mockup
  reference for the stats layout or the players table (the mockup's tiles didn't match
  OBS-3's actual required metrics) — built from the spec/rule text directly, linked from a
  small entry point on the Account screen, not a BottomNav tab.
- `BottomNav` gained its final two tabs, **History** and **Ranks** (the label the mockup
  actually uses for the leaderboard tab) — this is the point where Phase 3/4's "only Home +
  Account for now, the rest wait for their destinations to exist" comment resolves itself.
- Tests: unit (win-rate math via the schema/service layer, `FR-` invite code format);
  integration suites for history filtering, leaderboard scoping (confirms local/AI and
  guest-side games never appear, confirms the min-games threshold), the full friend
  lifecycle (search → request → accept/decline, mutual-request auto-accept, invite-link
  accept), and admin auth (every `/api/admin/*` route 401s without a session, 200s with
  one). `leaderboard.integration.test.ts` and the new e2e `leaderboard.spec.ts` both play
  actual Socket.io games (5 of them, to clear the ranking threshold) rather than mocking
  game data, so they also exercise the session-sharing fix above end to end. New
  `admin.spec.ts`. As with every phase so far, I could not run the integration suites or
  e2e specs locally (no Postgres/Docker in this environment) — CI is the real evidence.

**Phase 6 (deploy) landed — tooling only, live deployment is pending on the user actually
running it.** Per the user's explicit decision, the backend deploy mechanism (the spec's
§11 open decision) is a **manual pull + PM2-reload script**, not GitHub Actions SSH
automation — deliberately, to avoid putting VPS SSH keys in GitHub secrets. This phase is
entirely config/scripts/docs; no application code changed. The user has a real Hetzner VPS
(`204.168.235.206`) and used **DuckDNS** (`xoduel.duckdns.org`, already pointed at that IP)
instead of a purchased domain + Cloudflare — the deploy tooling was updated for that
topology in a follow-up (still same phase): **Certbot** (`certbot --nginx`) issues a free
Let's Encrypt certificate directly for the origin instead of a Cloudflare Origin
Certificate, since there's no CDN/proxy in front of this VPS at all. **This is a deliberate
deviation from spec §10/rules OP-4/SEC-7's literal "behind Cloudflare" wording** — the
user's explicit call, not an oversight. The underlying intent (production traffic over
TLS, no plaintext to the origin from the public internet) is still met, just via Certbot's
cert directly on Nginx rather than a Cloudflare Origin Certificate behind Cloudflare's
proxy; there's no CDN/WAF/DDoS layer this way, which is a real, accepted tradeoff for a
small project like this, not a security equivalent in every respect.

- `deploy/setup-vps.sh` — one-time Ubuntu 24.04 bootstrap (Node 20.x via NodeSource,
  PostgreSQL 18 via the PGDG apt repo since Ubuntu 24.04's own repos don't carry it, Nginx,
  Certbot + its Nginx plugin, PM2, `ufw` firewall allowing only 22/80/443, the `xo_duel`
  Postgres role/database, repo clone to `/opt/xo-duel`).
- `deploy/nginx.conf` — reverse-proxy site config for `xoduel.duckdns.org`, port 80 only on
  purpose: `certbot --nginx` edits this file **in place** on the VPS to add the port-443
  SSL block (pointing at its own cert under `/etc/letsencrypt/live/`) and the redirect —
  the checked-in version is deliberately just the pre-Certbot starting point, not what
  ends up live. WebSocket upgrade headers are in there from the start (without them,
  Socket.io's connections fail to upgrade — API-8). Certbot's own package install sets up
  automatic renewal (a systemd timer or cron job depending on the install) with no extra
  action needed beyond confirming it's there (`docs/runbook.md` shows how).
- `deploy/ecosystem.config.cjs` — PM2 process file; holds no secrets, `cwd` is derived from
  the file's own location (`__dirname`) so it resolves correctly regardless of where
  `deploy.sh` happens to invoke `pm2` from.
- `deploy/deploy.sh` — the actual redeploy script a human runs by hand after a merge: pull,
  `npm ci`, build, migrate, `pm2 startOrReload --update-env`, then checks `/api/health`
  and fails loudly if it doesn't respond. Domain-agnostic — unaffected by the DuckDNS
  switch.
- `docs/runbook.md` — the spec's named deliverable: one-time setup (VPS → confirm DuckDNS
  resolves → Nginx site config → Certbot → confirm auto-renewal → `.env` → PM2 → Vercel, in
  order, since later steps depend on earlier ones), routine deploy, restart, logs, rollback
  (with the migration-rollback caveat — `deploy.sh`'s `npm run migrate` only ever applies
  new migrations forward, checking out an older commit doesn't undo one a bad release
  already applied), and troubleshooting (including Certbot-specific failure modes).

**What's still genuinely pending, and can't be done from here:** actually running these
scripts against the real VPS, and the spec's own Phase 6 verify line — a live domain
reachable off-network, a full online game played between two real devices through the
deployed stack, health check green. I can write and syntax-check every file, but I can't
SSH into the box myself or click through Certbot's interactive prompts; that's the user's
to do, following the runbook.

**Still stubbed / not started (out of v1 scope on purpose):** admin moderation
(suspend/ban — explicitly a future phase per SEC-10), nickname-editing UI for guests,
everything in the spec's §12 "Future phases" list (matchmaking queue, ELO rating,
spectator mode/chat, PWA, tournaments). Every phase from the suggested build order is now
built; what's left is standing up the infrastructure this phase's tooling targets.
