# Runbook

Operational reference for XO Duel's production deployment (spec §10). Deploys are a
**manual pull + PM2-reload script** — the spec left the exact mechanism (GitHub Actions
SSH-deploy vs. a self-hosted runner vs. a manual script) as an open decision (§11); this
project uses the manual script, on purpose, to avoid putting VPS SSH keys in GitHub
secrets. There is no CI automation that deploys on merge — someone runs `deploy/deploy.sh`
by hand.

## Architecture

```
Browser
  ├─ https://xoduel.vercel.app       → Vercel (client/, static build)
  │     REST (/api/*)                   rewritten same-origin to the VPS (client/vercel.json)
  │     Socket.io (/socket.io/*)         connects directly to the VPS instead — see below
  └─ https://xoduel.duckdns.org      → Hetzner VPS (204.168.235.206), DuckDNS A record
                                          → Nginx (deploy/nginx.conf, TLS via a Let's
                                            Encrypt cert from Certbot, WS upgrade headers)
                                              → Node/Socket.io (PM2-managed, :3000)
                                                  → PostgreSQL (local, same VPS)
```

The client and server are deployed independently — a Vercel deploy and a VPS deploy are
two separate actions, not one combined release step. Unlike a Cloudflare-fronted setup,
there's no proxy/CDN in front of the VPS here — DuckDNS just resolves the hostname
straight to the origin IP, and Certbot's certificate is what visitors' browsers actually
see. That also means no CDN-level DDoS/WAF layer, which is a fine, common tradeoff for a
small project like this but worth knowing about.

**Why REST and Socket.io take different paths to the same VPS.** The frontend
(`xoduel.vercel.app`) and backend (`xoduel.duckdns.org`) are different registrable
domains — genuinely cross-*site*, not just cross-origin. Mobile Safari/Chrome enforce
cross-site cookie restrictions more strictly than desktop, so calling the duckdns origin
directly from the browser meant the session cookie could complete a login but then fail
to come back on the next request — "logged in, then immediately looks like a guest
again," and only on mobile, which made it easy to miss in desktop-only testing.
`client/vercel.json` rewrites `/api/*` to the VPS so REST calls are same-origin from the
browser's perspective, sidestepping the cross-site cookie problem entirely. Socket.io
can't use the same trick, though — Vercel's rewrite proxies plain HTTP fine but does not
reliably proxy a WebSocket upgrade to an external destination (confirmed: the handshake
gets a 404 through the rewrite), so `useOnlineGame.ts` connects sockets straight to
`https://xoduel.duckdns.org`, bypassing Vercel entirely. The Socket.io server already has
CORS configured for the Vercel origin (`index.ts`'s `cors: { origin: env.clientOrigin }`),
so the direct cross-origin connection itself is fine.

**Known limitation this reopens:** `gameSocket.ts`'s `socketPlayerId()` attributes
`game_players.player_id` (for stats/history/leaderboard) from the session cookie, and that
cookie may not reach the direct cross-site socket connection on some mobile browsers — the
same restriction the rewrite fixes for REST. The game still plays and completes correctly
either way (`playerId` is nullable throughout `gameService.ts`), but the result may not
attribute to a mobile player's account. Not fixed — would need the socket to carry its own
non-cookie identity (e.g. a signed token minted over the already-working REST session and
passed in the handshake) instead of depending on the cookie.

## One-time setup

This only happens once, when standing the environment up for the first time.

1. **Provision the VPS.** Hetzner Cloud → new server → CX23, Helsinki, Ubuntu 24.04. Note
   its public IP (`204.168.235.206` in this deployment).
2. **DuckDNS.** Already done — `xoduel.duckdns.org` points at `204.168.235.206`. Nothing to
   configure here; just confirm it resolves (`dig +short xoduel.duckdns.org` should print
   the VPS's IP) before moving on to Certbot, since Certbot's HTTP challenge needs the
   hostname to actually resolve to this box.
3. **Run the bootstrap script** on the fresh VPS as root:
   ```
   curl -fsSL https://raw.githubusercontent.com/varshithpeddineni1/XO-duel/main/deploy/setup-vps.sh | bash
   ```
   This installs Node, PostgreSQL 18, Nginx, Certbot, and PM2; creates the `xo_duel`
   Postgres role/database; sets up the firewall (only 22/80/443 reachable); and clones the
   repo to `/opt/xo-duel`. It prints a checklist of everything still needed below — read
   that output, it's the same list as here.
4. **Nginx site config.**
   ```
   cp /opt/xo-duel/deploy/nginx.conf /etc/nginx/sites-available/xo-duel
   ln -s /etc/nginx/sites-available/xo-duel /etc/nginx/sites-enabled/
   rm -f /etc/nginx/sites-enabled/default
   nginx -t && systemctl reload nginx
   ```
   `deploy/nginx.conf` already has `server_name xoduel.duckdns.org` — no editing needed
   unless the hostname changes.
5. **Certbot.**
   ```
   certbot --nginx -d xoduel.duckdns.org
   ```
   Interactive: it asks for an email (renewal/urgency notices) and ToS agreement, then
   offers to redirect HTTP to HTTPS — say yes. Certbot edits
   `/etc/nginx/sites-available/xo-duel` **in place** to add the port-443 server block
   pointing at its own cert under `/etc/letsencrypt/live/xoduel.duckdns.org/` and the
   port-80 redirect. From this point on, don't re-copy `deploy/nginx.conf` over the live
   file — that would overwrite Certbot's additions and you'd need to re-run this step.
6. **Confirm auto-renewal.** Certbot's package install already set up automatic renewal —
   check which mechanism landed on this system:
   ```
   systemctl list-timers | grep certbot   # newer Ubuntu: a systemd timer, runs twice daily
   cat /etc/cron.d/certbot 2>/dev/null    # older installs: a cron entry instead
   ```
   Either way, test it actually works without waiting for a real expiry:
   ```
   certbot renew --dry-run
   ```
7. **Fill in `.env`** at `/opt/xo-duel/.env` (the setup script copied `.env.example` there
   as a starting point): a real `SESSION_SECRET` (`openssl rand -hex 32`), the admin
   credentials (`npm run hash-admin -- '<passcode>'`), `DATABASE_URL` if you changed the
   default Postgres password, and `CLIENT_ORIGIN=https://xoduel.vercel.app` (needed for
   CORS — API-7's guest play and everything else breaks without this being right).
8. **PM2 on boot.** `pm2 startup systemd` and follow the one printed command (it registers
   a systemd unit so PM2 — and this app — survive a reboot).
9. **First deploy.** `cd /opt/xo-duel && ./deploy/deploy.sh` (see below).
10. **Vercel.** New Vercel project from this GitHub repo, Root Directory set to `client`,
    framework preset Vite (build command `npm run build`, output `dist`). No custom domain
    needed — Vercel's own `xoduel.vercel.app` is the production URL. **Leave
    `VITE_API_URL`/`VITE_SOCKET_URL` unset** in the project's environment variables — the
    client defaults to same-origin (routed through `client/vercel.json`'s rewrite) for REST
    and directly to `https://xoduel.duckdns.org` for Socket.io. Setting `VITE_API_URL` to
    the duckdns origin directly (an earlier iteration of this deploy did exactly that)
    bypasses the rewrite and breaks session cookies on mobile Safari/Chrome — see
    Troubleshooting. Only set these explicitly if intentionally pointing the client at a
    different backend (e.g. a staging VPS).
11. **Executable bits.** If cloned/deployed from a Windows-originated commit, the scripts'
    executable bit may not have survived (`git config core.filemode` is often `false` on
    Windows). Run `chmod +x deploy/*.sh` once on the VPS if `./deploy/deploy.sh` complains
    about permissions.

## Deploy (routine)

After a PR is merged to `main`:

```
ssh <user>@<vps-ip>
cd /opt/xo-duel
./deploy/deploy.sh
```

This pulls `main`, runs `npm ci`, builds the server, runs any new migrations, reloads PM2
(zero-downtime — `pm2 startOrReload`), and checks `/api/health` at the end. If the health
check fails, it exits non-zero and tells you to check `pm2 logs`.

## Restart

Without a code change (e.g. after editing `.env` or if the process looks stuck):

```
cd /opt/xo-duel
set -a; source .env; set +a
pm2 restart xo-duel-server --update-env
```

## Logs

```
pm2 logs xo-duel-server          # tail application logs (structured JSON — OBS-1)
pm2 logs xo-duel-server --lines 200 --nostream   # last 200 lines, no follow
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

## Rollback

1. Find the last known-good commit SHA (GitHub's commit history, or `git log` on the VPS).
2. On the VPS:
   ```
   cd /opt/xo-duel
   git checkout <good-sha>
   ./deploy/deploy.sh
   ```
3. **Migration caveat:** `deploy.sh` always runs `npm run migrate`, which only ever applies
   _new_ migrations forward (DB-2) — checking out an older commit does **not** undo a
   migration that a bad deploy already applied. If the bad release included a schema
   change you need to undo, run `npm run migrate:down` (once, manually — it only rolls
   back the single most recent migration) _before_ re-deploying the older commit, and
   confirm the rollback is actually safe for whatever data was written under the new
   schema in the meantime.
4. `git checkout main` afterward once you're done, so the working tree doesn't stay
   detached.

## Troubleshooting

- **Health check fails after deploy:** `pm2 logs xo-duel-server` first — most likely a
  missing/wrong `.env` value (`DATABASE_URL`, `SESSION_SECRET`) or a migration that failed
  partway. `pm2 status` shows if the process is even running.
- **Sockets connect but games don't work / instantly disconnect:** check Nginx is actually
  sending the WebSocket upgrade headers (`deploy/nginx.conf`'s `Upgrade`/`Connection`
  lines) — a proxy in front of Socket.io that drops those silently downgrades to
  polling-only or fails outright.
- **CORS errors in the browser console:** `CLIENT_ORIGIN` in `.env` doesn't match the
  Vercel domain actually being used (including `https://` vs `http://` and the exact
  subdomain).
- **Certbot's HTTP challenge fails:** `dig +short xoduel.duckdns.org` doesn't resolve to
  this box, or port 80 isn't actually reachable (check `ufw status`, and that Nginx is
  running and the `xo-duel` site is enabled) — the ACME HTTP-01 challenge Certbot uses
  needs both to be true before it can issue a certificate.
- **Browser shows a certificate warning:** confirm `/etc/letsencrypt/live/xoduel.duckdns.org/`
  actually has current files (`certbot certificates` lists expiry), and that
  `certbot renew --dry-run` succeeds — if renewal quietly broke, the cert eventually
  expires even though nothing else changed.
- **Login works on desktop but shows as a guest on mobile:** classic cross-site cookie
  issue (see "Why REST and Socket.io take different paths" above). Confirm the Vercel
  project's `VITE_API_URL` is actually unset — if it's pointed at
  `https://xoduel.duckdns.org` directly, REST calls bypass the same-origin rewrite and
  mobile Safari/Chrome will drop the session cookie.
- **A Vercel deploy doesn't seem to include a change that's definitely on `main`:** check
  the Vercel project's Deployments tab is building the commit you expect — a deploy can
  get stuck pointing at an old commit if auto-deploy-on-push isn't actually wired up for
  that branch. Don't assume a `git push` alone means the live site updated; verify (e.g.
  `curl https://xoduel.vercel.app/api/health` should reach `client/vercel.json`'s rewrite,
  not 404).
- **Online multiplayer sockets fail to connect only through the Vercel domain** (WS
  handshake returns a 404), but work fine hitting `xoduel.duckdns.org` directly: expected,
  not a bug — see the architecture note above. Sockets must connect straight to the VPS;
  they were never meant to go through Vercel's rewrite.
- **A shared invite link says "Game ... is not joinable" moments after creating it:**
  check `WAITING_GAME_GRACE_PERIOD_MS` (`.env`, default 5 min) — a still-`waiting` invite
  is abandoned this long after the creator's socket disconnects with nobody having joined
  yet. Mobile browsers commonly suspend a backgrounded tab's WebSocket the instant the
  user switches apps to actually send the link, so this needs to comfortably cover that
  realistic workflow — it's deliberately separate from `DISCONNECT_GRACE_PERIOD_MS` (30s),
  which is tuned for mid-game network blips where a live opponent is already waiting, not
  for "give someone time to receive and open a link."
- **A join or move silently does nothing** — socket connects fine, console is empty,
  screen just doesn't update: check for an unsurfaced ack error first (inspect the WS
  frames' ack payload). `App.tsx` surfaces `useOnlineGame`'s `error` in the same banner as
  everything else, but this class of bug (a real failure with zero client-side feedback)
  has happened here before — if it resurfaces, look for a new code path that captures an
  error without ever rendering it, rather than assuming it's a connection problem.
- **`trust proxy` / secure-cookie behavior looks wrong despite `.env` looking right:**
  `deploy/ecosystem.config.cjs` hardcodes `NODE_ENV: 'production'` in PM2's `env` block,
  which takes precedence over `.env` (whose own `.env.example` default is
  `development` — easy to leave unedited on a fresh VPS). Don't just read `.env`; check
  what the running process actually has: `pm2 env <id>` or `pm2 show xo-duel-server`.
- **Reconnect-after-disconnect note for `useOnlineGame.ts`:** the stored reconnect token
  must be re-read from `sessionStorage` *inside* the socket's `'connect'` handler, not
  once when the effect mounts. `'connect'` fires again on every automatic socket.io
  reconnect (e.g. a mobile browser resuming a backgrounded tab's dropped socket), and
  reading the token once outside that handler previously meant every reconnect resent a
  stale/empty value forever — reconnect only ever worked via an actual full page refresh.
  Worth keeping in mind if this hook gets touched again.
