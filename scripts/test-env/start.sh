#!/usr/bin/env bash
# The QA environment: the whole shop running locally like production, for a browser tester
# (docs/ai-workflow/testing.md). Its own database (commerce_qa_e2e, recreated and seeded on every
# start), its own ports (no clash with the dev servers or `pnpm e2e`), the fake Wire for payments
# (Wire has no test mode, ADR-0016) and Mailpit for email.
#
#   scripts/test-env/start.sh      # build, seed, start everything; prints the addresses
#   scripts/test-env/stop.sh       # stop it (by the PIDs saved here)
#
# Logs and PIDs: .ai/test-env/ (gitignored). Needs Docker for Postgres/S3/Mailpit (`pnpm db:up`).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DIR="$ROOT/.ai/test-env"
LOGS="$DIR/logs"
mkdir -p "$LOGS"

API_PORT=4110
DASHBOARD_PORT=5283
STOREFRONT_PORT=3113
WIRE_PORT=4199
API="http://localhost:$API_PORT"
STOREFRONT="http://localhost:$STOREFRONT_PORT"
DASHBOARD="http://localhost:$DASHBOARD_PORT"
WIRE="http://localhost:$WIRE_PORT"

die() { echo "error: $*" >&2; exit 1; }

for pidfile in "$DIR"/*.pid; do
  [ -e "$pidfile" ] && die "the QA environment seems to be running ($pidfile); run scripts/test-env/stop.sh first"
done
for port in $API_PORT $DASHBOARD_PORT $STOREFRONT_PORT $WIRE_PORT; do
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then die "port $port is in use"; fi
done

# The QA database: the dev server's Postgres, database commerce_qa_e2e (prepare.ts only recreates
# databases whose name ends in _e2e).
QA_DB="$(cd "$ROOT" && node -e '
  try { process.loadEnvFile(".env") } catch {}
  const url = new URL(process.env.DATABASE_URL ?? "");
  url.pathname = "/commerce_qa_e2e";
  console.log(url.toString());
')"
# Test-only values, shared with the e2e run (e2e/env.ts, apps/api/test/fakeWire.ts).
SECRET_KEY="e2e-secret-key-not-for-production-0123456789"
WIRE_KEY="sk_live_fake_for_tests"
WIRE_SECRET="whsec_fake_for_tests"

wait_for() { # <url> <what> <log>
  for _ in $(seq 1 150); do
    if curl -fsS -o /dev/null "$1" 2>/dev/null; then return 0; fi
    sleep 2
  done
  echo "--- last lines of $3" >&2
  tail -20 "$3" >&2
  die "$2 did not start ($1)"
}

start() { # <name> <dir> <command...>: runs in the background, PID in .ai/test-env/<name>.pid
  # Fully detached: the subshell keeps no stdout open (a `| tail` on this script must end), and
  # `$!` is the server itself (nohup and env exec into it), not a wrapper shell.
  local name="$1" dir="$2"
  shift 2
  (
    cd "$dir" || exit 1
    nohup "$@" >"$LOGS/$name.log" 2>&1 </dev/null &
    echo $! >"$DIR/$name.pid"
  ) >/dev/null 2>&1 </dev/null
}

echo "== services (Postgres, S3, Mailpit)"
(cd "$ROOT" && pnpm -s db:up >/dev/null)

echo "== database $QA_DB (recreated)"
(cd "$ROOT/e2e" && DATABASE_URL_E2E="$QA_DB" node prepare.ts) >"$LOGS/prepare.log" 2>&1 \
  || { tail -20 "$LOGS/prepare.log" >&2; die "preparing the database failed"; }

echo "== fake Wire on $WIRE"
start wire "$ROOT/e2e" env FAKE_WIRE_PORT=$WIRE_PORT FAKE_WIRE_WEBHOOK_URL="$API/webhooks/wire" \
  node storefront/fakeWireServer.ts
wait_for "$WIRE/health" "the fake Wire" "$LOGS/wire.log"

PAYMENTS=(PAYMENT_GATEWAYS=dummy,wire WIRE_API_KEY="$WIRE_KEY" WIRE_WEBHOOK_SECRET="$WIRE_SECRET"
  WIRE_API_URL="$WIRE/v1")

echo "== API on $API"
start api "$ROOT/apps/api" env DATABASE_URL="$QA_DB" PORT=$API_PORT SECRET_KEY="$SECRET_KEY" \
  ALLOWED_GRAPHQL_ORIGINS="$DASHBOARD" PUBLIC_URL="$API" STAFF_NOTIFICATION_EMAILS=qa-staff@example.com \
  "${PAYMENTS[@]}" node --env-file-if-exists=../../.env src/server.ts
wait_for "$API/health/ready" "the API" "$LOGS/api.log"

echo "== worker (emails, paid checkouts, reconciliation)"
start worker "$ROOT/apps/api" env DATABASE_URL="$QA_DB" SECRET_KEY="$SECRET_KEY" \
  EMAIL_URL=smtp://localhost:1026 STAFF_NOTIFICATION_EMAILS=qa-staff@example.com "${PAYMENTS[@]}" \
  node --env-file-if-exists=../../.env src/worker.ts

echo "== products"
(cd "$ROOT" && node scripts/test-env/seed.ts "$API/graphql" "$DASHBOARD") | tee "$LOGS/seed.log"

echo "== dashboard on $DASHBOARD"
start dashboard "$ROOT" env VITE_API_URL="$API/graphql" \
  pnpm --filter @commerce/dashboard exec vite --port $DASHBOARD_PORT --strictPort
wait_for "$DASHBOARD" "the dashboard" "$LOGS/dashboard.log"

echo "== storefront on $STOREFRONT (production build; takes a minute)"
(cd "$ROOT" && pnpm --filter @commerce/storefront build) >"$LOGS/storefront-build.log" 2>&1 \
  || { tail -30 "$LOGS/storefront-build.log" >&2; die "the storefront build failed"; }
# A copy of the standalone build, so a later `pnpm e2e` rebuild can't change it under us.
rm -rf "$DIR/storefront"
cp -R "$ROOT/apps/storefront/.next/standalone" "$DIR/storefront"
mkdir -p "$DIR/storefront/apps/storefront/.next"
cp -R "$ROOT/apps/storefront/.next/static" "$DIR/storefront/apps/storefront/.next/static"
start storefront "$DIR/storefront/apps/storefront" env NODE_ENV=production HOSTNAME=127.0.0.1 \
  PORT=$STOREFRONT_PORT API_URL="$API" STOREFRONT_URL="$STOREFRONT" \
  IMAGE_ORIGINS="$API,http://localhost:8333" PAYMENT_PROVIDERS=wire WIRE_CHECKOUT_ORIGIN="$WIRE" \
  node server.js
wait_for "$STOREFRONT/api/health" "the storefront" "$LOGS/storefront.log"

cat <<EOF

QA environment is up (logs in .ai/test-env/logs/):
  storefront   $STOREFRONT
  dashboard    $DASHBOARD       staff: e2e-staff@example.com / e2e-staff-password-0123 (test values)
  API          $API/graphql
  fake Wire    $WIRE             (its payment page has a "Pay with QPay" button)
  Mailpit      http://localhost:8026   (every email the shop sends)
Stop it with scripts/test-env/stop.sh
EOF
