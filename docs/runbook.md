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
    needed — Vercel's own `xoduel.vercel.app` is the production URL. Set its
    `VITE_API_URL`/`VITE_SOCKET_URL` environment variables to
    `https://xoduel.duckdns.org`.
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
