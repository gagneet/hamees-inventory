#!/usr/bin/env bash
# =============================================================================
# Hamees Inventory Management System - Production Deploy Script
# Usage: ./scripts/deploy.sh
#
# Order of operations — nothing live changes until the new code has compiled:
#   1. install, prisma generate/validate
#   2. verification build into .next-staging (a failed build stops here: no DB change)
#   3. pg_dump backup
#   4. one-time baseline, prisma migrate deploy, drift check
#   5. production build into .next (previous build kept in .next-prev, restored on failure)
#   6. PM2 restart and /api/health check (anything but HTTP 200 exits 1)
#
# The staging build is a compile gate only and is not moved into place: Next embeds its
# distDir name in the server bundles (`distDir:".next"` in every route module), so a
# renamed build would look for its manifests under the old directory name.
# =============================================================================

set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Colour

# ── Config ───────────────────────────────────────────────────────────────────
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="hamees-inventory"
APP_PORT=3009
LOG_DIR="$APP_DIR/logs"
STAGING_DIST=".next-staging"
PREV_DIST=".next-prev"
KEEP_BACKUPS=10

# ── Helpers ──────────────────────────────────────────────────────────────────
log()    { echo -e "${BLUE}[DEPLOY]${NC} $*"; }
success(){ echo -e "${GREEN}[✓]${NC} $*"; }
warn()   { echo -e "${YELLOW}[!]${NC} $*"; }
die()    { echo -e "${RED}[✗]${NC} $*" >&2; exit 1; }

# Read KEY from .env without sourcing it (values may contain $, & or spaces).
# An already-exported variable wins, matching how Next and Prisma load .env.
env_value() {
  local key="$1" line re_dq re_sq
  if [[ -n "${!key:-}" ]]; then printf '%s' "${!key}"; return 0; fi
  line="$(grep -E "^[[:space:]]*(export[[:space:]]+)?${key}=" "$APP_DIR/.env" | tail -n 1 || true)"
  [[ -n "$line" ]] || return 0
  line="${line#*=}"
  line="${line%$'\r'}"
  re_dq='^"(.*)"[[:space:]]*(#.*)?$'
  re_sq="^'(.*)'[[:space:]]*(#.*)?\$"
  if [[ "$line" =~ $re_dq || "$line" =~ $re_sq ]]; then
    line="${BASH_REMATCH[1]}"
  else
    line="${line%%[[:space:]]#*}"
    line="${line%"${line##*[![:space:]]}"}"
  fi
  printf '%s' "$line"
}

# Drop the Prisma-only "schema" query parameter (libpq rejects it), keeping the others.
strip_schema_param() {
  local url="$1" base query part
  local -a parts=() kept=()
  if [[ "$url" != *\?* ]]; then printf '%s' "$url"; return 0; fi
  base="${url%%\?*}"
  query="${url#*\?}"
  IFS='&' read -r -a parts <<< "$query"
  for part in "${parts[@]}"; do
    [[ -z "$part" || "$part" == schema=* ]] || kept+=("$part")
  done
  if (( ${#kept[@]} )); then
    local IFS='&'
    printf '%s?%s' "$base" "${kept[*]}"
  else
    printf '%s' "$base"
  fi
}

url_decode() { printf '%b' "${1//%/\\x}"; }

# Run a libpq tool with the password in its environment (never on the command line).
with_pgpass() {
  if [[ -n "$PG_PASSWORD" ]]; then PGPASSWORD="$PG_PASSWORD" "$@"; else "$@"; fi
}

pg_query() { with_pgpass psql "$PG_URL" -X -A -t -v ON_ERROR_STOP=1 -c "$1"; }

# Run a Prisma CLI command against the migration URL, printing a trimmed log; keeps its exit code.
run_prisma() {
  local out status=0
  out="$(DATABASE_URL="$MIGRATE_URL" pnpm exec prisma "$@" 2>&1)" || status=$?
  printf '%s\n' "$out" | grep -v 'injected env' | tail -n 20 || true
  return "$status"
}

# ── Preflight checks ─────────────────────────────────────────────────────────
log "Starting deployment of $APP_NAME..."
echo "========================================"

cd "$APP_DIR" || die "Cannot cd to $APP_DIR"

command -v pnpm    >/dev/null 2>&1 || die "pnpm not found. Install with: npm install -g pnpm"
command -v pm2     >/dev/null 2>&1 || die "pm2 not found. Install with: npm install -g pm2"
command -v node    >/dev/null 2>&1 || die "node not found"
command -v curl    >/dev/null 2>&1 || die "curl not found"
command -v pg_dump >/dev/null 2>&1 || die "pg_dump not found — install postgresql-client so the database can be backed up before migrating"
command -v psql    >/dev/null 2>&1 || die "psql not found — install postgresql-client"

[[ -f "$APP_DIR/.env" ]] || die ".env file not found at $APP_DIR/.env"

log "Checking environment variables..."
DATABASE_URL_VALUE="$(env_value DATABASE_URL)"
NEXTAUTH_URL_VALUE="$(env_value NEXTAUTH_URL)"
[[ -n "$DATABASE_URL_VALUE" ]]           || die "DATABASE_URL is not set in .env"
[[ -n "$(env_value NEXTAUTH_SECRET)" ]]  || die "NEXTAUTH_SECRET is not set in .env"
[[ -n "$NEXTAUTH_URL_VALUE" ]]           || die "NEXTAUTH_URL is not set in .env"
success "Environment variables OK"

# pg_dump / psql / the Prisma schema engine need a host in the URL; for unix-socket URLs
# ("postgresql://user:pass@/db?host=/var/run/postgresql") insert "localhost".
MIGRATE_URL="$(printf '%s' "$DATABASE_URL_VALUE" | sed 's#@/#@localhost/#')"
LIBPQ_URL="$(strip_schema_param "$MIGRATE_URL")"

# Split the password out of the libpq URL so it never appears in the process list
PG_URL="$LIBPQ_URL"
PG_PASSWORD=""
URL_RE='^([A-Za-z][A-Za-z0-9+.-]*://)([^:@/]*)(:(.*))?@([^@]*)$'
if [[ "$LIBPQ_URL" =~ $URL_RE ]]; then
  PG_URL="${BASH_REMATCH[1]}${BASH_REMATCH[2]}@${BASH_REMATCH[5]}"
  if [[ -n "${BASH_REMATCH[3]}" ]]; then
    PG_PASSWORD="$(url_decode "${BASH_REMATCH[4]}")"
  fi
fi

mkdir -p "$LOG_DIR"

# ── Step 1: Install dependencies and generate the Prisma client ──────────────
log "Step 1/6: Installing dependencies and generating the Prisma client..."
pnpm install --frozen-lockfile 2>&1 | tail -5
run_prisma generate || die "prisma generate failed"
run_prisma validate || die "prisma validate failed"
success "Dependencies installed, Prisma client generated"

# ── Step 2: Verification build (does not touch .next or the database) ────────
log "Step 2/6: Verification build into $STAGING_DIST..."
BUILD_START=$(date +%s)
TSCONFIG_BACKUP="$(mktemp)"
cp tsconfig.json "$TSCONFIG_BACKUP"
rm -rf "$STAGING_DIST"
# tsconfig.json includes .next/types (generated route types of the *live* build). If a route was
# deleted since then, those stale declarations fail this build's type check. They are only used
# for type checking — the running server never reads them — and step 5 regenerates them.
rm -rf .next/types
STAGING_OK=1
NEXT_DIST_DIR="$STAGING_DIST" pnpm run build 2>&1 || STAGING_OK=0
# next build adds "<distDir>/types/**/*.ts" to tsconfig.json; keep the tracked file unchanged
cp "$TSCONFIG_BACKUP" tsconfig.json
rm -f "$TSCONFIG_BACKUP"
rm -rf "$STAGING_DIST"
(( STAGING_OK )) || die "Build failed — nothing was changed (database and running app untouched). Check the output above."
success "Verification build passed in $(( $(date +%s) - BUILD_START ))s"

# ── Step 3: Back up the database ─────────────────────────────────────────────
log "Step 3/6: Backing up the database..."
BACKUP_DIR="$APP_DIR/backups"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/pre-deploy-$(date +%Y%m%d-%H%M%S).dump"
with_pgpass pg_dump --format=custom --no-owner --file="$BACKUP_FILE" "$PG_URL" \
  || die "Database backup failed — aborting before migrations"
chmod 600 "$BACKUP_FILE"
success "Database backed up to $BACKUP_FILE"

# Keep the newest $KEEP_BACKUPS pre-deploy dumps (other dumps in backups/ are left alone)
find "$BACKUP_DIR" -maxdepth 1 -name 'pre-deploy-*.dump' -printf '%T@ %p\n' \
  | sort -rn | tail -n +$((KEEP_BACKUPS + 1)) | cut -d' ' -f2- \
  | while IFS= read -r old; do rm -f -- "$old"; done

# ── Step 4: Migrate ──────────────────────────────────────────────────────────
log "Step 4/6: Applying database migrations..."

# One-time baseline: databases created before migrations were tracked already contain the
# 0_init schema. If the schema exists but 0_init is not recorded as successfully applied
# (no _prisma_migrations table, an empty one, or a failed 0_init attempt), mark it applied.
HAS_USERS="$(pg_query "select to_regclass('public.\"User\"') is not null")" \
  || die "Cannot query the database (psql failed) — aborting before migrations"
HAS_MIGRATIONS="$(pg_query "select to_regclass('public._prisma_migrations') is not null")" \
  || die "Cannot query the database (psql failed) — aborting before migrations"
BASELINE_DONE="f"
if [[ "$HAS_MIGRATIONS" == "t" ]]; then
  BASELINE_DONE="$(pg_query "select exists (select 1 from _prisma_migrations where migration_name = '0_init' and finished_at is not null and rolled_back_at is null)")" \
    || die "Cannot read _prisma_migrations (psql failed) — aborting before migrations"
fi
if [[ "$HAS_USERS" == "t" && "$BASELINE_DONE" != "t" ]]; then
  warn "Existing database without a recorded baseline — marking 0_init as applied"
  run_prisma migrate resolve --applied 0_init || die "Could not record the 0_init baseline"
fi

# Apply pending migrations (prisma/migrations). Never uses db push / reset.
run_prisma migrate deploy \
  || die "prisma migrate deploy failed. The running app was not changed. Backup: $BACKUP_FILE"
success "Database migrations applied"

# Read-only check that the database now matches prisma/schema.prisma (exit 2 = differences)
DRIFT_STATUS=0
run_prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code || DRIFT_STATUS=$?
case "$DRIFT_STATUS" in
  0) success "No schema drift" ;;
  2) die "The database schema differs from prisma/schema.prisma after migrating (see the diff above). The running app was not changed. Backup: $BACKUP_FILE" ;;
  *) die "The schema drift check failed to run (exit $DRIFT_STATUS). The running app was not changed. Backup: $BACKUP_FILE" ;;
esac

# ── Step 5: Production build ─────────────────────────────────────────────────
log "Step 5/6: Building into .next (previous build kept in $PREV_DIST)..."
BUILD_START=$(date +%s)
rm -rf "$PREV_DIST"
if [[ -d .next ]]; then
  mkdir -p "$PREV_DIST"
  find .next -mindepth 1 -maxdepth 1 ! -name cache -exec cp -a {} "$PREV_DIST/" \;
fi
if ! pnpm run build 2>&1; then
  if [[ -d "$PREV_DIST" ]]; then
    rm -rf .next
    mv "$PREV_DIST" .next
    warn "Restored the previous build into .next"
  fi
  die "Production build failed after migrations were applied. The app was not restarted. Backup: $BACKUP_FILE"
fi
success "Build completed in $(( $(date +%s) - BUILD_START ))s"

# ── Step 6: Restart PM2 and verify ───────────────────────────────────────────
log "Step 6/6: Restarting PM2 process and checking health..."

if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 restart "$APP_NAME" --update-env
  success "PM2 process '$APP_NAME' restarted"
else
  warn "PM2 process '$APP_NAME' not found, starting fresh..."
  pm2 start "$APP_DIR/ecosystem.config.js"
  success "PM2 process '$APP_NAME' started"
fi

# Save PM2 process list for auto-restart on reboot
pm2 save --force >/dev/null 2>&1
success "PM2 process list saved"

MAX_WAIT=60
HTTP_CODE="000"
for (( waited = 0; waited < MAX_WAIT; waited += 2 )); do
  HTTP_CODE="$(curl -sS -m 5 -o /dev/null -w '%{http_code}' "http://localhost:$APP_PORT/api/health" 2>/dev/null || true)"
  [[ "$HTTP_CODE" == "200" ]] && break
  sleep 2
done

if [[ "$HTTP_CODE" != "200" ]]; then
  pm2 status "$APP_NAME" || true
  echo "" >&2
  echo "  Logs:            pm2 logs $APP_NAME --lines 50" >&2
  echo "  Roll back code:  rm -rf .next && mv $PREV_DIST .next && pm2 restart $APP_NAME" >&2
  echo "  Restore the DB:  pg_restore --clean --if-exists --no-owner -d <database> $BACKUP_FILE" >&2
  die "Health check failed: /api/health returned HTTP ${HTTP_CODE:-000} after ${MAX_WAIT}s"
fi
success "Application healthy on port $APP_PORT (HTTP 200)"

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "========================================"
success "Deployment complete!"
echo ""
echo "  App:        http://localhost:$APP_PORT"
echo "  Public URL: $NEXTAUTH_URL_VALUE"
echo "  Backup:     $BACKUP_FILE"
echo "  Rollback:   previous build in $PREV_DIST"
echo "  PM2:        pm2 status $APP_NAME"
echo "  Logs:       pm2 logs $APP_NAME"
echo ""

pm2 status "$APP_NAME"
