#!/usr/bin/env bash
# One-time bootstrap for a fresh Ubuntu 24.04 Hetzner CX23 instance (spec §10, adapted for
# DuckDNS + Certbot instead of a purchased domain + Cloudflare). Run once, as root, on a
# brand-new server:
#
#   curl -fsSL https://raw.githubusercontent.com/varshithpeddineni1/XO-duel/main/deploy/setup-vps.sh | bash
#
# or copy it over and run `bash setup-vps.sh` after cloning the repo yourself. This is NOT
# the redeploy script — that's deploy.sh, run after this one-time setup and on every
# subsequent release. See docs/runbook.md for the full picture, including the manual
# Nginx/Certbot/Vercel steps this script can't do for you.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this as root (or with sudo)." >&2
  exit 1
fi

REPO_URL="https://github.com/varshithpeddineni1/XO-duel.git"
APP_DIR="/opt/xo-duel"

echo "==> System update"
apt-get update
apt-get upgrade -y

# Closest to the spec's v20.20.2 — NodeSource tracks the 20.x line, not an exact patch
# pin. Re-run 'apt-get install nodejs' later to pick up patch releases.
echo "==> Node.js 20.x (NodeSource)"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

echo "==> PostgreSQL 18 (PGDG apt repo — Ubuntu 24.04's own repos don't carry v18)"
apt-get install -y postgresql-common
/usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y
apt-get install -y postgresql-18

echo "==> Nginx"
apt-get install -y nginx

echo "==> Certbot (Let's Encrypt) — issues/renews the TLS cert for the DuckDNS hostname"
apt-get install -y certbot python3-certbot-nginx

echo "==> PM2 (global)"
npm install -g pm2

echo "==> Firewall — only SSH/HTTP/HTTPS reach this box from outside; Postgres stays local"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> Postgres role + database (matches .env.example's default DATABASE_URL)"
sudo -u postgres psql -v ON_ERROR_STOP=1 <<-'SQL'
	DO $$
	BEGIN
	  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'xo_duel') THEN
	    CREATE ROLE xo_duel WITH LOGIN PASSWORD 'xo_duel';
	  END IF;
	END
	$$;
SQL
sudo -u postgres psql -v ON_ERROR_STOP=1 -tc "SELECT 1 FROM pg_database WHERE datname = 'xo_duel'" \
  | grep -q 1 || sudo -u postgres createdb -O xo_duel xo_duel

echo "==> Application checkout"
if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"
if [ ! -f .env ]; then
  cp .env.example .env
  chmod 600 .env
fi

cat <<-EOF

	Done. Still to do by hand — see docs/runbook.md for the full walkthrough:

	  1. Edit $APP_DIR/.env with real production values (DATABASE_URL's password if you
	     changed the default above, SESSION_SECRET, ADMIN_USERNAME/ADMIN_PASSWORD_HASH via
	     'npm run hash-admin', CLIENT_ORIGIN pointed at your Vercel URL, e.g.
	     https://xoduel.vercel.app).
	  2. DuckDNS: nothing to do here if xoduel.duckdns.org already points at this box's IP.
	  3. Copy deploy/nginx.conf into /etc/nginx/sites-available/xo-duel, symlink it into
	     sites-enabled, remove the default site, 'nginx -t' then 'systemctl reload nginx'.
	  4. Run 'certbot --nginx -d xoduel.duckdns.org' (interactive — email + ToS agreement,
	     say yes to redirecting HTTP to HTTPS). This edits the Nginx config in place to add
	     the SSL block; don't re-copy deploy/nginx.conf over it afterward. Certbot's own
	     package install already set up automatic renewal (a systemd timer or cron job
	     depending on how it installed) — docs/runbook.md shows how to confirm it.
	  5. Run 'pm2 startup systemd' and follow its printed instructions so PM2 survives a
	     reboot.
	  6. Run deploy/deploy.sh for the first real deploy (builds, migrates, starts PM2).

EOF
