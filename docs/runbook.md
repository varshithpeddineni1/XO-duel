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
  ├─ https://<your-domain>            → Vercel (client/, static build)
  └─ https://api.<your-domain>        → Cloudflare (DNS + SSL, free tier)
                                          → Hetzner CX23 VPS
                                              → Nginx (deploy/nginx.conf, TLS via
                                                Cloudflare Origin Certificate, WS upgrade)
                                                  → Node/Socket.io (PM2-managed, :3000)
                                                      → PostgreSQL (local, same VPS)
```

The client and server are deployed independently — a Vercel deploy and a VPS deploy are
two separate actions, not one combined release step.

## One-time setup

This only happens once, when standing the environment up for the first time.

1. **Provision the VPS.** Hetzner Cloud → new server → CX23, Helsinki, Ubuntu 24.04. Note
   its public IP.
2. **Run the bootstrap script** on the fresh VPS as root:
   ```
   curl -fsSL https://raw.githubusercontent.com/varshithpeddineni1/XO-duel/main/deploy/setup-vps.sh | bash
   ```
   This installs Node, PostgreSQL 18, Nginx, and PM2; creates the `xo_duel` Postgres role/
   database; sets up the firewall (only 22/80/443 reachable); and clones the repo to
   `/opt/xo-duel`. It prints a checklist of everything still needed below — read that
   output, it's the same list as here.
3. **Domain + Cloudflare.** Add your domain to Cloudflare (update your registrar's
   nameservers to Cloudflare's). Create an A record for `api.<your-domain>` pointing at the
   VPS's IP, with the orange-cloud proxy **on**.
4. **Origin certificate.** Cloudflare dashboard → SSL/TLS → Origin Server → Create
   Certificate (defaults are fine, 15-year validity). Save the cert and key on the VPS:
   ```
   mkdir -p /etc/nginx/ssl
   # paste the certificate into /etc/nginx/ssl/cloudflare-origin.pem
   # paste the private key into    /etc/nginx/ssl/cloudflare-origin.key
   chmod 600 /etc/nginx/ssl/cloudflare-origin.key
   ```
   In Cloudflare's SSL/TLS settings, set the encryption mode to **Full (strict)** — this is
   what makes the origin certificate actually get used and satisfies SEC-7 (no plaintext
   between Cloudflare and the origin, not just visitor-to-Cloudflare).
5. **Nginx site config.**
   ```
   cp /opt/xo-duel/deploy/nginx.conf /etc/nginx/sites-available/xo-duel
   # edit server_name in that file to your real api.<your-domain>
   ln -s /etc/nginx/sites-available/xo-duel /etc/nginx/sites-enabled/
   rm -f /etc/nginx/sites-enabled/default
   nginx -t && systemctl reload nginx
   ```
6. **Fill in `.env`** at `/opt/xo-duel/.env` (the setup script copied `.env.example` there
   as a starting point): a real `SESSION_SECRET` (`openssl rand -hex 32`), the admin
   credentials (`npm run hash-admin -- '<passcode>'`), `DATABASE_URL` if you changed the
   default Postgres password, and `CLIENT_ORIGIN` set to your Vercel domain (needed for
   CORS — API-7's guest play and everything else breaks without this being right).
7. **PM2 on boot.** `pm2 startup systemd` and follow the one printed command (it registers
   a systemd unit so PM2 — and this app — survive a reboot).
8. **First deploy.** `cd /opt/xo-duel && ./deploy/deploy.sh` (see below).
9. **Vercel.** New Vercel project from this GitHub repo, Root Directory set to `client`,
   framework preset Vite (build command `npm run build`, output `dist`). Set its
   `VITE_API_URL`/`VITE_SOCKET_URL` environment variables to `https://api.<your-domain>`.
   Point your apex/`www` domain at the Vercel project in Cloudflare DNS too (Vercel's own
   docs cover the exact CNAME/A record it wants).
10. **Executable bits.** If cloned/deployed from a Windows-originated commit, the scripts'
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
- **Cloudflare shows an SSL error:** confirm the encryption mode is "Full (strict)" (not
  "Flexible") and that the origin certificate/key paths in `deploy/nginx.conf` match where
  you actually saved them.
