#!/usr/bin/env bash
# =============================================================================
# Hamees Inventory Management System - Production Deploy Script
# Usage: ./scripts/deploy.sh
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

# ── Helpers ──────────────────────────────────────────────────────────────────
log()    { echo -e "${BLUE}[DEPLOY]${NC} $*"; }
success(){ echo -e "${GREEN}[✓]${NC} $*"; }
warn()   { echo -e "${YELLOW}[!]${NC} $*"; }
die()    { echo -e "${RED}[✗]${NC} $*" >&2; exit 1; }

# ── Preflight checks ─────────────────────────────────────────────────────────
log "Starting deployment of $APP_NAME..."
echo "========================================"

cd "$APP_DIR" || die "Cannot cd to $APP_DIR"

# Verify required tools
command -v pnpm  >/dev/null 2>&1 || die "pnpm not found. Install with: npm install -g pnpm"
command -v pm2   >/dev/null 2>&1 || die "pm2 not found. Install with: npm install -g pm2"
command -v node  >/dev/null 2>&1 || die "node not found"

# Check .env exists
[[ -f "$APP_DIR/.env" ]] || die ".env file not found at $APP_DIR/.env"

# Check required env vars
log "Checking environment variables..."
source "$APP_DIR/.env" 2>/dev/null || true
[[ -n "${DATABASE_URL:-}" ]]    || die "DATABASE_URL is not set in .env"
[[ -n "${NEXTAUTH_SECRET:-}" ]] || die "NEXTAUTH_SECRET is not set in .env"
[[ -n "${NEXTAUTH_URL:-}" ]]    || die "NEXTAUTH_URL is not set in .env"
success "Environment variables OK"

# Create logs dir if needed
mkdir -p "$LOG_DIR"

# ── Step 1: Install dependencies ─────────────────────────────────────────────
log "Step 1/6: Installing dependencies..."
pnpm install --frozen-lockfile 2>&1 | tail -5
success "Dependencies installed"

# ── Step 2: Generate Prisma client ───────────────────────────────────────────
log "Step 2/6: Generating Prisma client..."
pnpm exec prisma generate 2>&1 | tail -3
success "Prisma client generated"

# ── Step 3: Run database migrations ──────────────────────────────────────────
log "Step 3/6: Applying database schema..."
# Using db push (not migrate dev) as the project uses push-based schema management
pnpm exec prisma db push --skip-generate 2>&1 | tail -5
success "Database schema up to date"

# ── Step 4: Build the application ────────────────────────────────────────────
log "Step 4/6: Building application (this takes ~35 seconds)..."
BUILD_START=$(date +%s)

if ! pnpm run build 2>&1; then
  die "Build failed! Check output above for TypeScript/ESLint errors."
fi

BUILD_END=$(date +%s)
BUILD_TIME=$((BUILD_END - BUILD_START))
success "Build completed in ${BUILD_TIME}s"

# ── Step 5: Restart PM2 process ──────────────────────────────────────────────
log "Step 5/6: Restarting PM2 process..."

if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  # Process exists — restart it
  pm2 restart "$APP_NAME" --update-env
  success "PM2 process '$APP_NAME' restarted"
else
  # First-time start
  warn "PM2 process '$APP_NAME' not found, starting fresh..."
  pm2 start "$APP_DIR/ecosystem.config.js"
  success "PM2 process '$APP_NAME' started"
fi

# Save PM2 process list for auto-restart on reboot
pm2 save --force >/dev/null 2>&1
success "PM2 process list saved"

# ── Step 6: Verify the application ───────────────────────────────────────────
log "Step 6/6: Verifying application health..."

# Wait for the app to be ready
MAX_WAIT=30
WAITED=0
while [[ $WAITED -lt $MAX_WAIT ]]; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$APP_PORT" 2>/dev/null || echo "000")
  if [[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "307" || "$HTTP_CODE" == "302" ]]; then
    break
  fi
  sleep 2
  WAITED=$((WAITED + 2))
done

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$APP_PORT" 2>/dev/null || echo "000")

if [[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "307" || "$HTTP_CODE" == "302" ]]; then
  success "Application responding on port $APP_PORT (HTTP $HTTP_CODE)"
else
  warn "Application not responding as expected (HTTP $HTTP_CODE). Checking PM2 status..."
  pm2 status "$APP_NAME"
  warn "Check logs: pm2 logs $APP_NAME --lines 50"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "========================================"
success "Deployment complete!"
echo ""
echo "  App:        http://localhost:$APP_PORT"
echo "  Public URL: ${NEXTAUTH_URL:-https://hamees.gagneet.com}"
echo "  PM2:        pm2 status $APP_NAME"
echo "  Logs:       pm2 logs $APP_NAME"
echo ""

pm2 status "$APP_NAME"
