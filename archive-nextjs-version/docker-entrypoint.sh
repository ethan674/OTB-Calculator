#!/bin/sh
set -e

# Applies any pending migrations to the SQLite file at DATABASE_URL (a path
# inside the mounted volume, so this is safe and idempotent on every restart).
npx prisma migrate deploy

# Seed only on first boot of a fresh volume, or if explicitly requested.
# Re-running the seed later is safe (it upserts) but would overwrite any
# manual edits to seeded stores/rates, so it does not run by default on
# every restart.
if [ "$RUN_SEED_ON_START" = "true" ]; then
  npm run seed
fi

exec npm run start
