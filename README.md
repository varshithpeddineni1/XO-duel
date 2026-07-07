# XO Duel

Challenge anyone, anywhere, anytime. Tic-Tac-Toe with local 2-player, a minimax AI
opponent, and real-time online multiplayer over shareable invite links.

## Features

- **Local 2-player** — pass-and-play on one device.
- **Vs. AI** — minimax opponent with four difficulty levels (easy / medium / hard /
  impossible).
- **Online multiplayer** — create a game, share the invite link (or QR code), and play in
  real time over Socket.io. Supports reconnect-after-disconnect and mutual-accept
  rematches.
- **Accounts** — guest sessions work everywhere, no login required; optional registration
  unlocks persistent stats, friends, and leaderboards.
- **Friends & leaderboards** — add friends by invite code, see a global or friends-only
  leaderboard.
- **Game history** — past games (local, AI, and online) with outcomes.
- **Admin dashboard** — single-admin account (no self-registration) with aggregate stats
  and a player list.

## Tech stack

A monorepo with three npm workspaces:

- **`client/`** — React + TypeScript + Vite. Talks to the server over REST and Socket.io.
- **`server/`** — Express + Socket.io + TypeScript, backed by PostgreSQL (via
  `node-pg-migrate` for schema migrations and `connect-pg-simple` for session storage).
- **`e2e/`** — Playwright end-to-end tests. Builds and starts its own client/server
  instances (`e2e/playwright.config.ts`'s `webServer`), so it doesn't need them already
  running — just a reachable Postgres with `DATABASE_URL` set in the environment.

## Getting started

**Prerequisites:** Node.js ≥ 20.19, a running PostgreSQL instance.

```bash
git clone <this repo>
cd XO-duel
npm install
cp .env.example .env   # then fill in real values — see below
npm run migrate
```

Fill in `.env` before running anything:

- `DATABASE_URL` — your local Postgres connection string.
- `SESSION_SECRET` — any long random string for local dev (`openssl rand -hex 32`).
- `ADMIN_USERNAME` / `ADMIN_PASSWORD_HASH` — only needed to access the admin dashboard;
  generate the hash with `npm run hash-admin -- '<passcode>'`.
- Everything else has a sensible default for local development.

Then, in two terminals:

```bash
npm run dev --workspace server   # http://localhost:3000
npm run dev --workspace client   # http://localhost:5173
```

Open `http://localhost:5173` — a guest session starts automatically, no login needed.

## Scripts

Run from the repo root unless noted:

| Command | What it does |
| --- | --- |
| `npm run test` | Unit tests for `server` and `client` (Vitest). |
| `npm run test:e2e` | Playwright end-to-end tests (`e2e` workspace). |
| `npm run lint` | ESLint across the whole repo. |
| `npm run typecheck` | TypeScript project-references check across workspaces. |
| `npm run format` / `format:write` | Prettier check / auto-fix. |
| `npm run migrate` / `migrate:down` | Apply / roll back the most recent DB migration. |
| `npm run hash-admin -- '<passcode>'` | Generate an Argon2 hash for `ADMIN_PASSWORD_HASH`. |

Server-only: `npm run test:integration --workspace server` (needs a real Postgres
instance — see `server/vitest.integration.config.ts`).

## Project structure

```
client/       React + Vite frontend
server/       Express + Socket.io API, PostgreSQL access, migrations
e2e/          Playwright end-to-end tests
deploy/       Production deploy scripts, Nginx config, PM2 process file
docs/
  runbook.md  Operational reference for the production deployment
  adr/        Architecture decision records
.specify/     Original spec, rules, and implementation plan this project was built from
```

## Deployment

The client deploys to Vercel; the server runs on a VPS behind Nginx, managed by PM2, with
a manual deploy script (no CI auto-deploy on merge, by design). Full setup, routine deploy,
rollback, and troubleshooting steps live in **[`docs/runbook.md`](docs/runbook.md)** — read
that before touching production.
