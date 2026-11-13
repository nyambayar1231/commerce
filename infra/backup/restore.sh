#!/usr/bin/env bash
# Restores a backup made by infra/backup/backup.sh into a database of the stack's Postgres
# (PLAN M10.4).
#
#   infra/backup/restore.sh s3://<backup-bucket>/commerce-<time>.dump [database]
#
# The database (default `commerce_restore`) is dropped and created again, so the default leaves
# the live `commerce` database alone: use it to check that a backup restores. Restoring over the
# live database is a deliberate, manual step (stop api and worker first, pass `commerce`).
set -euo pipefail

if [ $# -lt 1 ] || [ $# -gt 2 ] || [[ "$1" != s3://* ]]; then
  echo "usage: $0 s3://<backup-bucket>/<file>.dump [database]" >&2
  exit 2
fi
source_key="$1"
database="${2:-commerce_restore}"
if [[ ! "$database" =~ ^[a-z_][a-z0-9_]*$ ]]; then
  echo "invalid database name: $database" >&2
  exit 2
fi

export PATH="$HOME/.local/bin:/usr/local/bin:$PATH"
export AWS_REGION="${AWS_REGION:-ap-northeast-2}"

cd "$(dirname "$0")/../.."
compose=(docker compose -f docker-compose.prod.yml)

"${compose[@]}" exec -T postgres dropdb --username commerce --if-exists "$database"
"${compose[@]}" exec -T postgres createdb --username commerce "$database"
aws s3 cp "$source_key" - --only-show-errors \
  | "${compose[@]}" exec -T postgres \
    pg_restore --username commerce --dbname "$database" --no-owner --exit-on-error

echo "restored $source_key into $database"
"${compose[@]}" exec -T postgres psql --username commerce --dbname "$database" -Atc \
  "select 'users: ' || count(*) from \"user\" union all select 'orders: ' || count(*) from \"order\""
