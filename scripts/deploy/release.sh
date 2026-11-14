#!/usr/bin/env bash
# Releases one commit on the production server (PLAN M12). Run as root by the deploy workflow
# (.github/workflows/deploy.yml) through Session Manager, after it has checked the repository out
# at that commit, so this script is the commit's own version:
#
#   cd /home/ubuntu/commerce && sudo -u ubuntu git fetch -q origin \
#     && sudo -u ubuntu git checkout -q --detach <commit> \
#     && bash scripts/deploy/release.sh <commit> <artifacts-bucket> <backup-bucket>
#
# Steps: back up the database, load the commit's images (uploaded by the workflow to
# s3://<artifacts-bucket>/images/<commit>.tar.gz), run the migrations, restart the stack, then
# check that the API is healthy and that the dashboard and GraphQL answer through nginx. Any
# failure exits non-zero, which turns the workflow red. By hand (docs/deploy.md), the same command.
set -euo pipefail

if [ $# -ne 3 ] || [[ ! "$1" =~ ^[0-9a-f]{40}$ ]]; then
  echo "usage: $0 <full commit sha> <artifacts-bucket> <backup-bucket>" >&2
  exit 2
fi
commit="$1"
artifacts="$2"
backups="$3"

export AWS_REGION=ap-northeast-2
export PATH="/snap/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")/../.."

head="$(sudo -u ubuntu git rev-parse HEAD)"
if [ "$head" != "$commit" ]; then
  echo "the checkout is at $head, not $commit" >&2
  exit 1
fi

compose=(docker compose --env-file .env.prod -f docker-compose.prod.yml --profile https)

echo "== backup"
sudo -u ubuntu env -i HOME=/home/ubuntu PATH=/usr/bin:/bin \
  infra/backup/backup.sh "s3://$backups/nightly"

echo "== images"
aws s3 cp "s3://$artifacts/images/$commit.tar.gz" - --only-show-errors | gunzip | docker load

echo "== migrations"
"${compose[@]}" run --rm migrate

echo "== start"
"${compose[@]}" up -d --no-build --remove-orphans

echo "== health"
public_url="$(grep -E '^PUBLIC_URL=' .env.prod | cut -d= -f2-)"
healthy=""
for _ in $(seq 1 30); do
  if [ "$(docker inspect -f '{{.State.Health.Status}}' "$("${compose[@]}" ps -q api)")" = healthy ] &&
    curl -fsS -o /dev/null http://127.0.0.1:8080/ &&
    curl -fsS -X POST http://127.0.0.1:8080/graphql \
      -H 'content-type: application/json' -H "origin: $public_url" \
      -d '{"query":"{ shop { name } }"}' | grep -q '"shop"'; then
    healthy=yes
    break
  fi
  sleep 3
done
"${compose[@]}" ps --format '{{.Service}}: {{.Status}}'
if [ -z "$healthy" ]; then
  echo "the stack did not become healthy" >&2
  "${compose[@]}" logs --tail 30 api >&2
  exit 1
fi

echo "== released $commit"
