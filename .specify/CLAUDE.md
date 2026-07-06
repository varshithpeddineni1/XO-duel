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

**Phase 1 (foundations) landed.** npm workspaces (`server`, `client`, `e2e`) with
package.json/tsconfig per workspace, shared root ESLint (flat config) + Prettier, and
`.env.example`. `server/src/domain/gameLogic.ts` (`checkWinner`, `WIN_LINES`) and
`server/src/domain/minimax.ts` (`minimax` with alpha-beta, `getAiMove` for
easy/medium/hard/impossible) are ported from the design prototype, pure, and unit-tested
(19 tests, ~96% coverage) including an exhaustive proof that `impossible` never loses
(TEST-3). The initial migration (`server/migrations/..._initial-schema.js`) creates
`players`, `friendships`, `games`, `game_players`, `moves`, `events`, and the
connect-pg-simple `session` table with the indexes from the implementation plan; verified
up/down in CI against a Postgres service container (no local Postgres needed yet).
`client/src/styles/tokens.css` has the full OKLCH token set (light/dark via
`[data-theme]`, ARC-3a) extracted from `.specify/XO Duel.html`, plus a **minimal
placeholder** `App.tsx`/`theme.ts` (not a real screen) so the Playwright smoke suite and
CI have something real to exercise. `server/src/index.ts` is a `GET /api/health` stub
only — no game routes yet. `ci.yml` (lint, typecheck, test+coverage, migration check,
Playwright e2e, secret scan) and `pr-review.yml` (8-layer AI review via
`scripts/pr-review.mjs`) are both wired up and green.

**Still stubbed / not started:** all 11 real screens and their shared components (Board,
Cell, ModeButton, DifficultyCard, ResultBanner, HistoryRow, LeaderboardRow, BottomNav,
ThemeToggle, RematchButton), every REST endpoint beyond `/api/health`, all Socket.io
events, accounts/auth, friends, leaderboards, and the admin dashboard. No Playwright test
currently expects any of that to exist — the smoke spec only covers the placeholder page.
Next up per the suggested build order: Phase 2 (local 2-player + AI opponent, end to end,
server-authoritative per ARC-5).
