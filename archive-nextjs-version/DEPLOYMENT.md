# Deploying OTB Planner for team access

This app is designed for **single-machine, always-on deployment** — the whole
point of SQLite here is that there's no separate database service to run.
The set below uses Docker so the actual deploy step is just `docker compose
up -d`, with Caddy in front handling HTTPS automatically.

I could not test-build this Docker setup in the sandbox I built the app in
(no Docker available there), so treat the first deploy as a dry run — read
the logs, and see Troubleshooting below if something doesn't come up clean.

## What you need before starting

1. **A small VPS.** DigitalOcean, Hetzner, and Linode all have ~$5–6/mo
   plans (1 vCPU, 1GB RAM) that are comfortably enough for an internal tool
   used by a handful of people. Pick the Ubuntu 24.04 LTS image.
2. **A domain name pointed at the VPS.** You need *something* resolvable —
   a subdomain of a domain your company already owns (e.g.
   `otb.yourcompany.com`) is the clean option: add an **A record** for that
   subdomain pointing at the VPS's public IP. If you have zero domains, a
   free dynamic-DNS subdomain from [DuckDNS](https://www.duckdns.org) also
   works for this. Caddy (below) needs this to issue a real HTTPS
   certificate — it can't get one for a bare IP address.

## One-time server setup

SSH into the VPS as a non-root user with sudo, then:

```bash
# Docker + Compose plugin
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Firewall: only expose SSH, HTTP, HTTPS. Port 3000 is never exposed
# directly — Caddy is the only thing that talks to the app container.
sudo ufw allow OpenSSH
sudo ufw allow 80,443/tcp
sudo ufw enable
```

## Get the code onto the server

This project isn't currently in a git repo. Easiest path: push it to a
private GitHub/GitLab repo from your own machine, then on the server:

```bash
git clone <your-repo-url> otb-planner
cd otb-planner
```

(Or `rsync`/`scp` the folder up directly if you'd rather not use git.)

## Configure secrets

```bash
cp .env .env.bak   # keep the dev defaults for reference, then edit .env:
```

Edit `.env` (the same file docker-compose reads for variable substitution)
and set real values — **do not deploy with the dev defaults**:

```bash
TEAM_PASSWORD=<a real shared password, not the sample one>
SESSION_SECRET=<a long random string — e.g. `openssl rand -hex 32`>
DOMAIN=otb.yourcompany.com
```

Because this app's login model is "one shared team password, per-person
name," anyone who has the password can act as any named user — there's no
per-person password. That's fine on a trusted office LAN; once this is
reachable from the public internet for remote teammates, treat that shared
password like a real credential: don't reuse a password from elsewhere, and
rotate it if someone leaves the team.

## First boot (with seed data)

```bash
RUN_SEED_ON_START=true docker compose up -d --build
docker compose logs -f app   # watch it come up; Ctrl-C when you see "Ready"
```

`RUN_SEED_ON_START=true` only needs to be set this one time, to load the
sample stores/users/FX rates into the fresh database volume. Once it's up,
visit `https://<your-domain>` — Caddy will have automatically fetched an
HTTPS certificate.

Log in as `admin` with the `TEAM_PASSWORD` you set above, then go to
Admin → Stores and replace the seeded sample stores with your real ones
(or edit them in place), and Admin → FX Rates for your real currencies.

## Every deploy after that

```bash
git pull   # or re-sync your files
docker compose up -d --build
```

This does **not** re-seed (`RUN_SEED_ON_START` defaults to `false`), and
Prisma migrations run automatically on every container start — new
migrations you add later apply themselves.

## Adding a real teammate login

There's no self-registration. Add a user directly:

```bash
docker compose exec app node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.user.create({ data: { name: 'jane', role: 'planner' } }).then(() => prisma.\$disconnect());
"
```

(Swap `role: 'planner'` for `role: 'admin'` as needed.) They then log in
with that name and the shared `TEAM_PASSWORD`.

## Backing up the data

Everything lives in the `otb_data` Docker volume (the SQLite file):

```bash
docker compose exec app sh -c "sqlite3 /app/data/prod.db '.backup /app/data/backup.db'" 2>/dev/null \
  || docker cp $(docker compose ps -q app):/app/data/prod.db ./prod-backup-$(date +%F).db
```

Worth putting on a daily cron job on the host.

## Troubleshooting

- **Caddy can't get a certificate**: usually the DNS A record isn't
  pointing at the VPS yet, or ports 80/443 aren't reachable (check `sudo
  ufw status` and your cloud provider's firewall/security-group rules —
  some providers block these by default separately from `ufw`).
- **Prisma engine errors on Alpine** (`Unable to require libquery_engine`,
  mentions of `libssl`): the Dockerfile already installs `openssl` for
  this; if you still hit it, check `docker compose logs app` for the exact
  missing library and `apk add` it in the Dockerfile.
- **"relation/table does not exist"** on first boot: means `prisma migrate
  deploy` didn't run before the app started — check `docker compose logs
  app` for migration errors; the entrypoint script runs migrations before
  `npm run start` on every boot.
- **Want to reset everything**: `docker compose down -v` deletes the data
  volume too (irreversible) — back up first if you need to keep anything.

## If you outgrow a single VPS

The Prisma schema (`prisma/schema.prisma`) is deliberately structured so
switching the datasource from SQLite to Postgres is a one-line change
(`provider = "postgresql"`) plus pointing `DATABASE_URL` at a managed
Postgres instance — useful if you later move to a platform with ephemeral
disks (Railway, Render, Fly.io) or need multiple app instances behind a
load balancer.
