# ADR 0001: Phase 1 foundations — tooling and token decisions

**Status:** Accepted
**Date:** 2026-07-06

## Context

Phase 1 scaffolded the monorepo, design tokens, initial schema, and pure game logic with
no prior codebase to reconcile against. A few choices in that scaffold aren't spelled out
in the spec/implementation-plan and are worth recording per DOD-5, since a later contributor
(or reviewer) would otherwise have to reverse-engineer the reasoning from the diff.

## Decisions

**1. npm workspaces (`server`, `client`, `e2e`), not a separate tool (Turborepo/Nx/pnpm).**
The spec's stack is small enough (three packages, no shared internal libraries yet) that
npm's built-in workspace support covers it without adding a build-orchestration dependency.
Revisit if a fourth workspace (e.g. a shared types package) makes cross-package builds
non-trivial.

**2. Vite 8 / Vitest 4 / node-pg-migrate 8, not the 5.x/2.x/7.x lines originally drafted.**
The first `npm install` during scaffolding surfaced 8 vulnerabilities (npm audit) in the
originally-planned versions — moderate/high/critical findings in esbuild (via Vite 5),
Vitest's UI-server file-read advisory, and a glob CLI command-injection advisory (via
node-pg-migrate 7). All of these are dev-tooling-only (never shipped to a browser or the
production server process), but since this is a brand-new project with no legacy code
depending on the older APIs, the correct fix was to move to the current stable majors
rather than defensively pin old ones. Result: `npm audit` reports 0 vulnerabilities. Peer
dependency requirements from this bump (Vite 8 needs Node `^20.19.0 || >=22.12.0`) are
reflected in the root `package.json` `engines` field.

**3. `[data-theme]`, not the mockup's `[data-xo-theme]`.**
rules.md ARC-3a names the attribute `[data-theme]` explicitly; the Claude Design prototype
used `data-xo-theme`. rules.md outranks the mockup per its own authority order, so
`client/src/styles/tokens.css` uses `[data-theme]`.

**4. Alpha-beta pruning added to `minimax`, beyond what the mockup had.**
The mockup's `minimax` was a plain full-depth search (fine at Tic Tac Toe's tiny search
space). Spec §5 explicitly calls for alpha-beta, so it was added when porting the logic
into `server/src/domain/minimax.ts` — behaviorally identical output, fewer nodes explored.

## Consequences

- Contributors should expect Vite 8 / Vitest 4 config idioms (both are otherwise
  API-compatible with the 5.x/2.x docs most tutorials reference) rather than older tutorial
  content.
- Any future dependency bump that reintroduces a HIGH/CRITICAL `npm audit` finding should
  get the same treatment: prefer the current stable major over pinning an old vulnerable
  one, and record the reasoning here or in a new ADR.
