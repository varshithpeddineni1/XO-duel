# AGENTS.md

This file is the entry point for coding agents (the open `AGENTS.md`
convention). It mirrors [`CLAUDE.md`](./CLAUDE.md) — see that file for full
guidance — and defers to [`rules.md`](./rules.md) for the binding rules.

## Quick reference

- **Setup:** `npm install`, then `cp .env.example .env` and
  `npm run hash-admin`.
- **Run:** `npm run dev --workspace server` and `npm run dev --workspace
  client`.
- **Verify before claiming done:** `npm run lint && npm run typecheck && npm
  test`.
- **Database:** schema changes only via `node-pg-migrate` files in
  `server/migrations`.
- **Real-time:** online-game state (moves, presence, results) goes over
  Socket.io, never REST polling (API-8).
- **Server is authoritative:** never trust the client for turn order, move
  legality, or game-over state (ARC-5) — this holds for guests too, since no
  mode requires login (API-7).
- **Invite codes:** single-use and high-entropy, never reusable or guessable
  (API-5, API-6).
- **Commits:** Conventional Commits; branch from an issue; squash-merge via
  PR.
- **Keep `CLAUDE.md`'s "Current state" section current** — update it in the
  same PR whenever a build milestone lands (DOD-4, AGENT-4).
- **Never:** commit secrets, use `console.log` in backend code, hard-code
  config, or let the admin role write/modify player data (SEC-10, read-only
  in v1).

## Capabilities wired through MCP (AGENT-6)

GitHub (branches/PRs/review) and Playwright (self-verify UI with
screenshots).
