# XO Duel Engineering Rules

The non-negotiable rules for building XO Duel, the online Tic Tac Toe game.
This file is the scaled constitution and conventions for the project,
covering XO Duel's own stack and gameplay model.

**How to read it:** every rule is a testable SHALL statement with a stable ID
(for example `SEC-2`). The ID prefix shows the rule family. **Authority order**
(highest wins): this file, then the spec for a given feature
(`.specify/xo-duel-spec.md`), then defaults. A change to this file SHALL go
through a pull request with one approval.

**The locked stack:** Node.js with Express serving a REST API for
accounts/session/history/leaderboard reads, plus **Socket.io** for real-time
online-game play (moves, presence, disconnect/reconnect, rematch — no
polling; XO Duel's online mode is genuinely simultaneous, unlike a turn-based
app). Postgres as the system of record with versioned migrations, a React +
Vite (TypeScript) frontend deployed to Vercel, `express-session` + `argon2`
for both player accounts and the single admin, Vitest + supertest and
Playwright for tests, hosted on a Hetzner VPS behind Nginx and Cloudflare
(DNS + SSL).

**The three modes:** local (two players, one device), AI (minimax opponent,
selectable difficulty), and online (real-time 1-v-1 over Socket.io, joined by
invite link or QR code — no login required, no matchmaking queue in v1). See
the spec for gameplay detail.

---

## Part I: Method and governance

- **SDD-1** Every unit of work SHALL trace to an issue (a GitHub issue).
- **SDD-2** Code SHALL NOT be written for a feature until a human approves its
  spec.
- **SDD-3** The spec, not the code, SHALL be the authoritative contract;
  divergence is resolved in the same pull request.
- **SDD-4** The spec, the rules, and any plans SHALL live in version control
  under `.specify/` or `docs/`.
- **DOD-1** A change is done only when all tests pass and total coverage is at
  least 80 percent, with no per-run override.
- **DOD-2** The agent SHALL present evidence (command output, a test result,
  or a screenshot), not a claim of success.
- **DOD-3** Any user-facing change SHALL be verified through Playwright with a
  screenshot before it is called done.
- **DOD-4** Affected docs (README, `.env.example`, this file) SHALL be updated
  in the same pull request.
- **DOD-5** A significant decision SHALL be recorded as a short ADR in
  `docs/adr/` (context, decision, consequences).

## Part II: Git and pull request workflow

- **GIT-1** Branches SHALL use a prefix: `feat/`, `fix/`, `refactor/`,
  `chore/`, `docs/`, or `test/`, lowercase with hyphens.
- **GIT-2** Feature branches SHALL live three days at most; large work is
  split into smaller pull requests.
- **GIT-3** Commit messages SHALL follow Conventional Commits, for example
  `feat(game): add online invite join flow`.
- **GIT-4** A pull request SHALL open against `main`, fill in the template,
  and pass all checks before review.
- **GIT-5** Merging SHALL require at least one approval, all review
  conversations resolved, and green checks.
- **GIT-6** Merges SHALL be squash-only, so each pull request becomes one
  commit on `main`.
- **GIT-7** Direct pushes to `main` SHALL be blocked; all changes go through a
  pull request.
- **GIT-8** Pre-commit hooks SHALL run format, lint, trailing-whitespace,
  merge-conflict, and secret-detection checks.

## Part III: Repository governance

- **REPO-1** The repo SHALL contain a LICENSE, a README, a CONTRIBUTING
  guide, a CODEOWNERS file, and a pull request template.
- **REPO-2** `main` SHALL have branch protection: required pull request, one
  approval, conversation resolution, and passing checks.
- **REPO-3** The default branch SHALL be `main`.
- **REPO-4** `.gitignore` SHALL exclude `.env`, `node_modules`, build output
  (`dist/`, `build/`), coverage reports, and any key or credential files.
- **REPO-5** An `.env.example` SHALL document every environment variable with
  a description and no real values.
- **REPO-6** Dependency update alerts SHALL be enabled; HIGH or CRITICAL
  findings are addressed promptly.

## Part IV: Code quality

- **CODE-1** TypeScript SHALL be the implementation language for both the
  Express/Socket.io backend and the React frontend; ESLint and Prettier SHALL
  enforce lint and format, and public functions SHALL have explicit types.
- **CODE-2** API request/response bodies AND every Socket.io event payload
  SHALL be validated and typed with zod schemas, never passed around as
  untyped objects.
- **CODE-3** Configuration SHALL come from environment variables, never
  hard-coded.
- **CODE-4** Functions SHALL stay under 50 lines and files under 800 (target
  200 to 400).
- **CODE-5** Nesting SHALL stay at four levels or fewer; use early returns and
  guard clauses.
- **CODE-6** Every I/O operation SHALL have error handling, and error
  messages SHALL NOT expose internals.
- **CODE-7** Frontend code SHALL stay small and formatted; no secrets and no
  inline credentials.

## Part V: Architecture

- **ARC-1** Win/draw detection and the minimax AI SHALL be pure and
  unit-testable with no I/O, so unit tests need no database, network, or
  socket connection.
- **ARC-2** REST handlers and Socket.io event handlers SHALL stay thin;
  business logic (game creation, move validation, rematch, forfeiture) lives
  in a service layer.
- **ARC-3** Shared UI SHALL be built from one React component library and a
  single set of design tokens; raw hard-coded style values SHALL NOT appear
  in components.
- **ARC-3a (theming):** The app supports light and dark themes via a
  `[data-theme]` cascade over the design tokens. Components read colors only
  from tokens; no component may hard-code a color value. The active theme is
  chosen by the user (persisted) defaulting to the OS preference.
- **ARC-4** Every screen SHALL define explicit loading, empty, error, and
  success states.
- **ARC-5 (server-authoritative play):** The server SHALL be the sole
  authority on game state. The client SHALL NOT determine whose turn it is,
  whether a move is legal, or whether the game is over — it renders what the
  server confirms. This holds regardless of whether either player is logged
  in.

## Part VI: Data

- **DB-1** Postgres SHALL be the single store for application state and
  gameplay data.
- **DB-2** Schema changes SHALL be made only through versioned migrations
  checked into the repo (`node-pg-migrate`); no hand-edited schema.
- **DB-3** Tables and columns SHALL use snake_case names.
- **DB-4** Queries SHALL avoid N+1 patterns and index the fields used to look
  up games (including the online invite code) and players.
- **DB-5** An `events` table SHALL record game lifecycle events (created,
  joined, disconnected, completed, abandoned), and it SHALL be the audit
  trail the admin dashboard reads.
- **DB-6** The `moves` table SHALL be an append-only, ordered log per game
  (never updated or deleted), so any completed game can be replayed for
  history or review.
- **DB-7** Leaderboards (global and friend) SHALL be **derived on read** from
  `game_players` and related tables, not stored as denormalized ranking rows.

## Part VII: API and real-time contract

- **API-1** Every REST endpoint SHALL be described in an OpenAPI document
  checked into the repo, with a browsable API reference served in
  development.
- **API-2** All REST input SHALL be validated server-side with zod.
- **API-3** Errors (REST and socket error events) SHALL return a clear JSON
  shape and SHALL NOT leak stack traces, SQL, or file paths.
- **API-4** Every REST endpoint SHALL have an integration test using
  supertest against the Express app.
- **API-5 (invite codes are single-use):** An online game's invite code SHALL
  be usable only to join that one game, and SHALL stop accepting new joiners
  once two players are in the room. A stale or already-taken code SHALL
  return a clear "game not joinable" response, never a silent success.
- **API-6 (invite codes are unguessable):** Online invite codes SHALL be
  generated with sufficient entropy (a random string from a reasonably sized
  alphabet, collision-checked) that they cannot be feasibly brute-forced or
  guessed while a game is open.
- **API-7 (no login required to play):** Guest play SHALL remain fully
  available for all three modes — local, AI, and **online multiplayer**. No
  mode SHALL require an account to create or join a game. Registration only
  unlocks history, friends, and leaderboard participation for that player's
  side of a result.
- **API-8 (real-time, not polled):** Online-game moves, presence, and
  game-over state SHALL be pushed over Socket.io as they happen. REST SHALL
  NOT be used to poll for online-game state.
- **API-9 (leaderboards scoped correctly):** The global leaderboard and the
  friend leaderboard SHALL be scoped to `mode = 'online'` games between
  registered players only; local and AI-mode results SHALL NOT appear on
  either leaderboard. A guest's side of an online game SHALL NOT be recorded
  to any leaderboard or persistent history, even though the game itself plays
  normally for them.
- **API-10 (rate limiting):** Game-creation, game-join, login, and
  registration endpoints SHALL be rate-limited to prevent spam room creation
  and credential-stuffing.

## Part VIII: Security

- **SEC-1** Secrets (database credentials, session secret, admin password
  hash, the CI Anthropic API key used by the review agent, any tokens) SHALL
  come from environment variables and SHALL NEVER be committed.
- **SEC-2** Access SHALL use three roles enforced at the API layer: an
  anonymous **guest** player (nickname + session only), a **registered**
  player (an account), and an authenticated **admin**. Frontend checks are UX
  only — every privileged route SHALL also check the role server-side.
- **SEC-3** Accounts SHALL be **optional** for every mode, including online
  multiplayer (API-7). A player MAY optionally register, identified by a
  unique **username** plus an argon2 **password** hash; registering upgrades
  the player's existing row in place so their history is preserved.
- **SEC-4** Online game invite codes SHALL be single-purpose and expire on
  use (API-5, API-6). Friend invite links/codes are reusable by design and
  are NOT game codes; they grant only a friend request, never access to
  another user's data.
- **SEC-5** The app SHALL minimise player personal data; nicknames are
  treated as untrusted input and SHALL be length-limited and filtered.
- **SEC-6** Logs SHALL be structured and SHALL NOT contain anything beyond
  nicknames and gameplay events. No password, password hash, or session
  token SHALL ever appear in a log line.
- **SEC-7** Production traffic SHALL use TLS, provided by Cloudflare in front
  of Nginx; no plaintext HTTP to the origin from the public internet.
- **SEC-8** A leaked secret SHALL be rotated immediately and removed from
  history.
- **SEC-9** Dependencies SHALL be scanned for known vulnerabilities, with
  none left unresolved at HIGH or CRITICAL.
- **SEC-10 (admin is read-only in v1):** The admin role SHALL be able to view
  player and game data (SEC-2) but SHALL NOT be able to modify, suspend, or
  delete another player's account or data in v1. Moderation capability is a
  future phase and requires its own spec update before being built.

**Out of scope on purpose:** enterprise identity federation, PHI/HIPAA
handling, and customer-managed keys. XO Duel is a casual game, not a
regulated system.

## Part IX: Testing

- **TEST-1** Development SHALL be test-driven; tests are written before or
  with the code.
- **TEST-2** Total coverage SHALL be at least 80 percent, enforced in CI with
  no override.
- **TEST-3** Win/draw/loss detection and the minimax AI SHALL have unit
  tests covering: a horizontal/vertical/diagonal win, a full-board draw, an
  in-progress (non-terminal) board, and — for the AI — that the top
  difficulty tier never loses from any reachable board state.
- **TEST-4** Critical flows SHALL have Playwright end-to-end tests: local 2P
  game to completion, AI game to completion at each difficulty, creating and
  joining an online game via invite link, an online game to completion
  across two simulated clients, and viewing both leaderboards.
- **TEST-5** Socket.io event handlers SHALL have integration tests covering
  join, move validation (including rejecting an illegal or out-of-turn move),
  disconnect/reconnect, and the rematch flow.

## Part X: CI/CD and quality gates

- **CI-1** A CI workflow SHALL run on every pull request to `main`; a
  deploy-only workflow does not satisfy this.
- **CI-2** CI SHALL run lint, format, type check (`tsc`), tests with
  coverage, and the Playwright end-to-end suite, all as blocking steps with
  no `continue-on-error`.
- **CI-3** CI SHALL include a secret scan.
- **CI-4** An AI pull request review workflow (`pr-review.yml`) SHALL run an
  8-layer review on every pull request using the Anthropic API
  (`claude-sonnet-4-6`).
- **CI-5** GitHub Actions SHALL be pinned to commit SHAs, and workflow
  permissions SHALL be least privilege.
- **CI-6** Both the test gate and the security scan SHALL be green before the
  first feature merges; gates are never retrofitted.

## Part XI: Observability

- **OBS-1** All logs SHALL be structured JSON; `console.log` SHALL NOT appear
  in committed code.
- **OBS-2** Each log line SHALL carry a game identifier so a single game can
  be traced end to end, including across a disconnect/reconnect.
- **OBS-3** The admin dashboard SHALL read from the `events` table to show
  active players, games in progress, games over time, and outcome
  distribution.

## Part XII: Agentic workflow (the Claude Code part)

- **AGENT-1** The agent SHALL read the spec and produce a plan in plan mode
  before implementing a non-trivial change.
- **AGENT-2** The agent SHALL follow plan, implement, verify, and write tests
  before or with the code.
- **AGENT-3** The agent SHALL self-verify UI work through Playwright with a
  screenshot and SHALL NOT declare UI done without it.
- **AGENT-4** The repo SHALL maintain a `CLAUDE.md` and an `AGENTS.md`
  describing how to build, test, and verify.
- **AGENT-5** The agent SHALL open a pull request titled with the issue key,
  with a body generated from the diff.
- **AGENT-6** Agent capabilities SHALL be wired through MCP (GitHub and
  Playwright).

## Part XIII: Operations and hosting

- **OP-1** The README SHALL cover the description, prerequisites, local
  setup, environment variables, and how to deploy to the Hetzner VPS.
- **OP-2** The repo SHALL run locally via `docker-compose up` (or documented
  manual steps), with onboarding under thirty minutes.
- **OP-3** The Hetzner VPS SHALL run the app under PM2 so it restarts on
  crash and reboot.
- **OP-4** The public domain SHALL be served through Cloudflare (DNS + SSL)
  in front of Nginx, which reverse-proxies to the local Node/Socket.io
  process, correctly forwarding WebSocket upgrade headers.
- **OP-5** A short runbook SHALL document how to deploy, restart, view logs,
  and roll back on the Hetzner VPS.

---

## Appendix: the XO Duel "every repo must have" checklist

- This `rules.md`, plus the feature spec under `.specify/`
- `CLAUDE.md` and `AGENTS.md`
- LICENSE, README, CONTRIBUTING, CODEOWNERS, and a pull request template
- A pre-commit config and a blocking `ci.yml`
- A `pr-review.yml` 8-layer review agent
- `.env.example` and a correct `.gitignore`
- Branch protection on `main`
- At least 80 percent coverage and a Playwright suite
- Versioned database migrations from the first schema
- A runbook for the Hetzner deploy
