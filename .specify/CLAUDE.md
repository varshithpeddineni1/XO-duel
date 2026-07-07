# CLAUDE.md

Guidance for Claude Code (and any AI agent) working in this repo. The binding
rules live in [`rules.md`](./rules.md); the feature spec is in
[`.specify/xo-duel-spec.md`](./.specify/xo-duel-spec.md). Read both before
non-trivial work (AGENT-1).

## What this is

XO Duel: a full-stack online Tic Tac Toe game. Node + Express + Socket.io API,
Postgres, React + Vite SPA, hosted on a Hetzner VPS (backend) and Vercel
(frontend) behind Cloudflare (DNS + SSL) and Nginx. Guest play works for every
mode, including online multiplayer — no login wall anywhere (API-7). Accounts
are an optional upgrade for history, friends, and leaderboards.

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

**Still stubbed / not started:** `HistoryRow`, `LeaderboardRow`, `BottomNav` (no
history/leaderboard/account screens yet — Phase 4/5), the Online Multiplayer mode card on
home (Phase 3), all Socket.io events, accounts/auth, friends, leaderboards, and the admin
dashboard. Next up per the suggested build order: Phase 3 (real-time online multiplayer).
