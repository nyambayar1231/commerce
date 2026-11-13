#!/usr/bin/env bash
# Nightly database backup (PLAN M10.4): pg_dump of the stack's Postgres, streamed to S3.
#
#   infra/backup/backup.sh s3://<backup-bucket>[/prefix]
#
# Runs on the server next to docker-compose.prod.yml, from cron (docs/deploy.md). Uploads with the
# AWS CLI and the instance role's credentials (no keys on the server). The dump is pg_dump's custom
# format (compressed; restore with infra/backup/restore.sh). Old dumps are deleted by the backup
# bucket's lifecycle rule (infra/aws). Set AWS_ENDPOINT_URL to try it against a local S3 server.
set -euo pipefail

if [ $# -ne 1 ] || [[ "$1" != s3://* ]]; then
  echo "usage: $0 s3://<backup-bucket>[/prefix]" >&2
  exit 2
fi
destination="${1%/}"

# cron starts with a minimal PATH; `aws` is in /snap/bin (the server's snap), /usr/local/bin or
# ~/.local/bin (the AWS CLI installer).
export PATH="$HOME/.local/bin:/usr/local/bin:/snap/bin:$PATH"
export AWS_REGION="${AWS_REGION:-ap-northeast-2}"

cd "$(dirname "$0")/../.."
key="$destination/commerce-$(date -u +%Y-%m-%dT%H%M%SZ).dump"

docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump --username commerce --dbname commerce --format custom \
  | aws s3 cp - "$key" --only-show-errors

echo "$(date -u +%FT%TZ) backed up to $key"
