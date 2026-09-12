#!/usr/bin/env bash
# =============================================================================
# Hamees Inventory Management System - Production Deploy Script
# Usage: ./scripts/deploy.sh
#
# The live app runs from this directory: PM2 serves .next, and the server loads @prisma/client
# and the generated client from node_modules at runtime (.next/node_modules/@prisma/client-*
# links into node_modules). So nothing here, in the database or in PM2 changes until the release
# has been proven to build in an isolated copy:
#
#   1. verification build in a temporary copy (own node_modules and Prisma client, no database)
#   2. plan (read-only): pending migrations, dependency changes, Prisma client changes
#   3. if any of those change: stop the app. Old code must never run against a migrated schema or
#      a regenerated client, and nothing may be written between the backup and the migration
#   4. pg_dump backup
#   5. install / generate in place, one-time baseline, prisma migrate deploy, drift check
#   6. production build into .next (previous build kept in .next-prev)
#   7. PM2 (re)start and /api/health check (anything but HTTP 200 exits 1)
#
# A code-only release keeps the site up until the restart. If a step fails before anything live
# changed, a stopped app is started again as it was; otherwise the script says how to recover.
#
# Rehearsal overrides: DEPLOY_APP_NAME, DEPLOY_PORT, DEPLOY_PM2_SAVE=0 (don't `pm2 save`)
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
APP_NAME="${DEPLOY_APP_NAME:-hamees-inventory}"
APP_PORT="${DEPLOY_PORT:-3009}"
PM2_SAVE="${DEPLOY_PM2_SAVE:-1}"
LOG_DIR="$APP_DIR/logs"
PREV_DIST=".next-prev"
KEEP_BACKUPS=10

# ── State (drives what a failure does) ───────────────────────────────────────
APP_STOPPED=0     # this run stopped the app
LIVE_CHANGED=0    # node_modules, the Prisma client, the database or .next changed in place
MIGRATIONS_RAN=0  # migrate deploy applied at least one migration
VERIFY_DIR=""
BACKUP_FILE=""

# ── Helpers ──────────────────────────────────────────────────────────────────
log()    { echo -e "${BLUE}[DEPLOY]${NC} $*"; }
success(){ echo -e "${GREEN}[✓]${NC} $*"; }
warn()   { echo -e "${YELLOW}[!]${NC} $*"; }

recovery_help() {
  echo "" >&2
  echo "  Recover by either fixing the problem and running ./scripts/deploy.sh again, or going back:" >&2
  echo "    git checkout <previous release>; pnpm install --frozen-lockfile; pnpm exec prisma generate" >&2
  if (( MIGRATIONS_RAN )); then
    echo "    restore the database: pg_restore --clean --if-exists --no-owner -d <database> $BACKUP_FILE" >&2
  fi
  echo "    pnpm run build (or: rm -rf .next && mv $PREV_DIST .next), then pm2 restart $APP_NAME" >&2
  echo "  Logs: pm2 logs $APP_NAME --lines 50" >&2
}

die() {
  echo -e "${RED}[✗]${NC} $*" >&2
  if (( APP_STOPPED )); then
    if (( LIVE_CHANGED )); then
      echo "" >&2
      echo "  $APP_NAME is STOPPED: node_modules or the database no longer match the build it was running." >&2
      recovery_help
    else
      warn "Nothing live was changed — starting $APP_NAME again as it was"
      if pm2 start "$APP_NAME" >/dev/null 2>&1; then success "PM2 process '$APP_NAME' started"; else echo "  Start it manually: pm2 start $APP_NAME" >&2; fi
    fi
  fi
  exit 1
}

cleanup() { if [[ -n "$VERIFY_DIR" && -d "$VERIFY_DIR" ]]; then rm -rf "$VERIFY_DIR"; fi; }
trap cleanup EXIT
# An unguarded command failing under `set -e` still goes through die() (restart / recovery help)
trap 'die "Unexpected failure at line $LINENO (exit $?)"' ERR

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
command -v rsync   >/dev/null 2>&1 || die "rsync not found (used for the isolated verification build)"
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

# ── Step 1: Verification build in an isolated copy ───────────────────────────
log "Step 1/7: Verification build in an isolated copy (live app, node_modules and database untouched)..."
BUILD_START=$(date +%s)
VERIFY_DIR="$(mktemp -d "${TMPDIR:-/tmp}/hamees-verify.XXXXXX")"
rsync -a --exclude '/node_modules' --exclude '/.next' --exclude '/.next-*' --exclude '/backups' \
  --exclude '/logs' --exclude '/.git' "$APP_DIR/" "$VERIFY_DIR/"
VERIFY_LOG="$LOG_DIR/deploy-verify-build.log"
VERIFY_OK=1
(
  set -euo pipefail
  trap - ERR
  cd "$VERIFY_DIR"
  # No database for the copy: new code must not touch the live database before it is backed up
  # and migrated. Pages that read settings at build time log "DatabaseNotReachable" and fall back
  # to defaults — expected here, and this build is thrown away
  export DATABASE_URL="postgresql://verify-build@127.0.0.1:9/no-database"
  CI=true pnpm install --frozen-lockfile --prefer-offline
  pnpm exec prisma generate
  pnpm exec prisma validate
  pnpm run build
) > "$VERIFY_LOG" 2>&1 || VERIFY_OK=0
rm -rf "$VERIFY_DIR"
VERIFY_DIR=""
if (( ! VERIFY_OK )); then
  grep -v -E 'DatabaseNotReachable|Failed to load business settings|prisma:error|at F\.onError|^\s*$' "$VERIFY_LOG" | tail -n 40 >&2 || true
  die "Verification build failed — nothing was changed (database, node_modules and running app untouched). Full output: $VERIFY_LOG"
fi
success "Verification build passed in $(( $(date +%s) - BUILD_START ))s (output: $VERIFY_LOG)"

# ── Step 2: Plan (read-only) ─────────────────────────────────────────────────
log "Step 2/7: Checking what this release changes..."

DEPS_CHANGED=1
if [[ -f node_modules/.pnpm/lock.yaml ]] && cmp -s pnpm-lock.yaml node_modules/.pnpm/lock.yaml; then
  DEPS_CHANGED=0
fi

# The generated client keeps a `prisma format`-ed copy of the schema it was built from
CLIENT_CHANGED=1
GENERATED_SCHEMA="$(node -p "require('path').join(require('path').dirname(require.resolve('.prisma/client/default', {paths: [require.resolve('@prisma/client')]})), 'schema.prisma')" 2>/dev/null || true)"
SCHEMA_TMP_DIR="$(mktemp -d)"
cp prisma/schema.prisma "$SCHEMA_TMP_DIR/schema.prisma"
if [[ -n "$GENERATED_SCHEMA" && -f "$GENERATED_SCHEMA" ]] \
  && run_prisma format --schema "$SCHEMA_TMP_DIR/schema.prisma" >/dev/null \
  && cmp -s "$SCHEMA_TMP_DIR/schema.prisma" "$GENERATED_SCHEMA"; then
  CLIENT_CHANGED=0
fi
rm -rf "$SCHEMA_TMP_DIR"

HAS_USERS="$(pg_query "select to_regclass('public.\"User\"') is not null")" \
  || die "Cannot query the database (psql failed) — nothing was changed"
HAS_MIGRATIONS="$(pg_query "select to_regclass('public._prisma_migrations') is not null")" \
  || die "Cannot query the database (psql failed) — nothing was changed"
APPLIED_NAMES=""
if [[ "$HAS_MIGRATIONS" == "t" ]]; then
  APPLIED_NAMES="$(pg_query "select migration_name from _prisma_migrations where finished_at is not null and rolled_back_at is null")" \
    || die "Cannot read _prisma_migrations (psql failed) — nothing was changed"
fi
# Databases created before migrations were tracked already contain the 0_init schema
NEEDS_BASELINE=0
if [[ "$HAS_USERS" == "t" ]] && ! grep -qxF -- "0_init" <<< "$APPLIED_NAMES"; then NEEDS_BASELINE=1; fi
PENDING=()
while IFS= read -r name; do
  [[ -n "$name" ]] || continue
  grep -qxF -- "$name" <<< "$APPLIED_NAMES" && continue
  [[ "$name" == "0_init" && "$HAS_USERS" == "t" ]] && continue
  PENDING+=("$name")
done < <(find prisma/migrations -mindepth 2 -maxdepth 2 -name migration.sql -printf '%h\n' | xargs -rn1 basename | sort)

echo "  Dependencies changed:   $( (( DEPS_CHANGED )) && echo yes || echo no )"
echo "  Prisma client changed:  $( (( CLIENT_CHANGED )) && echo yes || echo no )"
echo "  Pending migrations:     ${#PENDING[@]}${PENDING[*]:+ (${PENDING[*]})}"
(( NEEDS_BASELINE )) && echo "  Baseline:               0_init will be marked as applied"
NEEDS_DOWNTIME=0
if (( DEPS_CHANGED || CLIENT_CHANGED || ${#PENDING[@]} > 0 )); then NEEDS_DOWNTIME=1; fi

# ── Step 3: Maintenance stop ─────────────────────────────────────────────────
if (( NEEDS_DOWNTIME )); then
  log "Step 3/7: Stopping $APP_NAME for the update (it starts again after the build, usually a few minutes)..."
  if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
    pm2 stop "$APP_NAME" >/dev/null
    APP_STOPPED=1
    success "PM2 process '$APP_NAME' stopped"
  else
    warn "PM2 process '$APP_NAME' not found — nothing to stop"
  fi
else
  log "Step 3/7: Code-only release — the site stays up until the restart"
fi

# ── Step 4: Back up the database ─────────────────────────────────────────────
log "Step 4/7: Backing up the database..."
BACKUP_DIR="$APP_DIR/backups"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/pre-deploy-$(date +%Y%m%d-%H%M%S).dump"
with_pgpass pg_dump --format=custom --no-owner --file="$BACKUP_FILE" "$PG_URL" \
  || die "Database backup failed — nothing was changed"
chmod 600 "$BACKUP_FILE"
success "Database backed up to $BACKUP_FILE"

# Keep the newest $KEEP_BACKUPS pre-deploy dumps (other dumps in backups/ are left alone)
find "$BACKUP_DIR" -maxdepth 1 -name 'pre-deploy-*.dump' -printf '%T@ %p\n' \
  | sort -rn | tail -n +$((KEEP_BACKUPS + 1)) | cut -d' ' -f2- \
  | while IFS= read -r old; do rm -f -- "$old"; done

# ── Step 5: Dependencies, Prisma client, migrations ──────────────────────────
log "Step 5/7: Updating dependencies, the Prisma client and the database..."
if (( DEPS_CHANGED )); then
  LIVE_CHANGED=1
  # The app is stopped, so pnpm may recreate node_modules (e.g. when it was installed from another
  # user's store) without asking: that prompt aborts without a TTY
  INSTALL_STATUS=0
  CI=true pnpm install --frozen-lockfile --prefer-offline --config.confirm-modules-purge=false 2>&1 | tail -n 5 || INSTALL_STATUS=$?
  (( INSTALL_STATUS == 0 )) || die "pnpm install failed"
  success "Dependencies installed"
else
  success "Dependencies already match pnpm-lock.yaml"
fi
if (( CLIENT_CHANGED || DEPS_CHANGED )); then
  LIVE_CHANGED=1
  run_prisma generate || die "prisma generate failed"
  success "Prisma client generated"
else
  success "Prisma client already generated from this schema"
fi
run_prisma validate || die "prisma validate failed"

if (( NEEDS_BASELINE )); then
  warn "Existing database without a recorded baseline — marking 0_init as applied"
  LIVE_CHANGED=1
  run_prisma migrate resolve --applied 0_init || die "Could not record the 0_init baseline"
fi

# Apply pending migrations (prisma/migrations). Never uses db push / reset.
if (( ${#PENDING[@]} > 0 )); then LIVE_CHANGED=1; MIGRATIONS_RAN=1; fi
run_prisma migrate deploy || die "prisma migrate deploy failed. Backup: $BACKUP_FILE"
success "Database migrations applied"

# Read-only check that the database now matches prisma/schema.prisma (exit 2 = differences)
DRIFT_STATUS=0
run_prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code || DRIFT_STATUS=$?
case "$DRIFT_STATUS" in
  0) success "No schema drift" ;;
  2) die "The database schema differs from prisma/schema.prisma after migrating (see the diff above). Backup: $BACKUP_FILE" ;;
  *) die "The schema drift check failed to run (exit $DRIFT_STATUS). Backup: $BACKUP_FILE" ;;
esac

# ── Step 6: Production build ─────────────────────────────────────────────────
log "Step 6/7: Building into .next (previous build kept in $PREV_DIST)..."
BUILD_START=$(date +%s)
rm -rf "$PREV_DIST"
if [[ -d .next ]]; then
  mkdir -p "$PREV_DIST"
  find .next -mindepth 1 -maxdepth 1 ! -name cache -exec cp -a {} "$PREV_DIST/" \;
fi
BUILD_STATUS=0
pnpm run build 2>&1 || BUILD_STATUS=$?
if (( BUILD_STATUS != 0 )); then
  if [[ -d "$PREV_DIST" ]]; then
    rm -rf .next
    mv "$PREV_DIST" .next
    warn "Restored the previous build into .next"
  fi
  die "Production build failed. Backup: $BACKUP_FILE"
fi
LIVE_CHANGED=1
success "Build completed in $(( $(date +%s) - BUILD_START ))s"

# ── Step 7: Restart PM2 and verify ───────────────────────────────────────────
log "Step 7/7: Restarting PM2 process and checking health..."

if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 restart "$APP_NAME" --update-env
  success "PM2 process '$APP_NAME' restarted"
else
  warn "PM2 process '$APP_NAME' not found, starting fresh..."
  pm2 start "$APP_DIR/ecosystem.config.js" --only "$APP_NAME" || die "Could not start '$APP_NAME' from ecosystem.config.js"
  success "PM2 process '$APP_NAME' started"
fi
APP_STOPPED=0

if [[ "$PM2_SAVE" == "1" ]]; then
  # Save PM2 process list for auto-restart on reboot
  pm2 save --force >/dev/null 2>&1
  success "PM2 process list saved"
fi

MAX_WAIT=60
HTTP_CODE="000"
for (( waited = 0; waited < MAX_WAIT; waited += 2 )); do
  HTTP_CODE="$(curl -sS -m 5 -o /dev/null -w '%{http_code}' "http://localhost:$APP_PORT/api/health" 2>/dev/null || true)"
  [[ "$HTTP_CODE" == "200" ]] && break
  sleep 2
done

if [[ "$HTTP_CODE" != "200" ]]; then
  pm2 status "$APP_NAME" || true
  recovery_help
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
echo "  Rollback:   previous build in $PREV_DIST$( (( MIGRATIONS_RAN )) && echo " (migrations ran: restore the backup too)" )"
echo "  PM2:        pm2 status $APP_NAME"
echo "  Logs:       pm2 logs $APP_NAME"
echo ""

pm2 status "$APP_NAME"
