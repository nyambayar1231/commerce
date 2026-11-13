# Deploying

How the production images are built and run (PLAN M9.6). No cloud vendor is chosen yet; this
describes the images, the configuration they need and a single-machine stack that runs them.

## Images

One `Dockerfile` at the root, two targets:

| Image | Target | Runs | Notes |
|---|---|---|---|
| `commerce-api` | `api` | the API (`node apps/api/src/server.ts`, port 4000) | also the **worker** (`node apps/api/src/worker.ts`) and the CLI (`node apps/api/src/cli.ts …`) |
| `commerce-web` | `web` | nginx on port 80 | the built dashboard plus a proxy to the API (`infra/nginx/default.conf`) |

The API has no build step: Node 22 strips the TypeScript types at load time, as in development.
The image keeps the workspace layout (`apps/api/src`, `packages/*/src`) with production
dependencies only; the tests are removed. It runs as the `node` user with `NODE_ENV=production`, so
JSON logs and the production configuration rules are on.

The dashboard's API URL is fixed at build time (`VITE_API_URL`, default `/graphql`, the same
origin through nginx). To serve the dashboard from a different origin than the API, build with
`--build-arg VITE_API_URL=https://api.example.com/graphql` and add that origin to
`ALLOWED_GRAPHQL_ORIGINS`.

## Configuration

Every variable is in `.env.prod.example`, with what it is for. The API and the worker check their
configuration at start (`apps/api/src/config.ts`) and exit with the full list of problems. In
production they also require `ALLOWED_GRAPHQL_ORIGINS`, `ALLOWED_CLIENT_HOSTS` and `PUBLIC_URL`,
and refuse the development `SECRET_KEY` and S3 secret.

- `SECRET_KEY`: `openssl rand -hex 32`; the API and the worker must share it.
- `TRUST_PROXY=true` only when the API is reached through a reverse proxy you control, that
  appends the client address to `X-Forwarded-For` (the `web` image does). Login throttling and the
  thumbnail limit key on that address.
- Logs are JSON lines on stdout; `LOG_LEVEL=debug` adds each GraphQL request step.

## Running the stack on one machine

```sh
cp .env.prod.example .env.prod          # replace every "change-me"
docker compose -f docker-compose.prod.yml --profile local-services up -d --build
docker compose -f docker-compose.prod.yml run --rm -e SUPERUSER_PASSWORD='…' api \
  node apps/api/src/cli.ts createsuperuser --no-input --email you@example.com
```

The dashboard and API are on http://localhost:8080 (`WEB_PORT`), caught emails on
http://localhost:8027 (`MAILPIT_PORT`). The one-off `migrate` service applies the migrations and
creates the media bucket before `api` and `worker` start; it runs again on every `up` and is safe
to repeat. The `local-services` profile adds SeaweedFS (standing in for S3) and Mailpit (standing
in for SMTP) so the stack runs anywhere. Without the profile only Postgres, the one-off `migrate`,
`api`, `worker` and `web` run, and `.env.prod` must point at a real S3 bucket and SMTP server
(the AWS deployment, PLAN M10). Pass the same `--profile` to every command of a stack that uses it.

## HTTPS with Caddy (the `https` profile)

The `https` Compose profile adds Caddy (`infra/caddy/Caddyfile`) on ports 80 and 443. It gets and
renews a Let's Encrypt certificate for `SITE_DOMAIN`, redirects HTTP to HTTPS, sends `/graphql` and
`/thumbnail/` straight to `api` and everything else to `web`. Certificates live in the
`caddy-data` volume; keep it, or Let's Encrypt's rate limits can bite after a few re-creations.

1. Point the domain's DNS A record (e.g. `admin.dino-craft.lol`) at the server, and open ports 80
   and 443. The certificate is requested on the first start, so DNS must already resolve.
2. In `.env.prod`: `SITE_DOMAIN=admin.dino-craft.lol`, `PUBLIC_URL` and
   `ALLOWED_GRAPHQL_ORIGINS` = `https://admin.dino-craft.lol`, `TRUST_PROXY=true`, and
   `WEB_PORT=127.0.0.1:8080` so the plain-HTTP `web` port is reachable only from the server.
3. Start with `--env-file .env.prod` (Compose reads `WEB_PORT` from it) and the profile:

```sh
docker compose --env-file .env.prod -f docker-compose.prod.yml --profile https up -d
```

Why the API routes skip nginx: Caddy drops any `X-Forwarded-For` a client sends and sets it to the
client's address, which the API reads as the last entry. Through nginx, Caddy's own address would
be appended last and every visitor would share one IP for login throttling. The session cookie is
always `Secure`, so logging in needs HTTPS (or `localhost`).

To try it locally, `SITE_DOMAIN=localhost` makes Caddy use its own local CA (`curl -k`), and
`HTTP_PORT`/`HTTPS_PORT` move the published ports.

## Upgrading

Build the new images, then run the migrations before starting the new API and worker:

```sh
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml run --rm migrate
docker compose -f docker-compose.prod.yml up -d
```

Migrations are forward-only (CLAUDE.md), so a release must work with the schema of the previous
one while it rolls out.

## Backups

`infra/backup/backup.sh s3://<backup-bucket>/nightly` streams a `pg_dump` (custom format,
compressed) of the stack's Postgres into S3 as `commerce-<UTC time>.dump`. On AWS it uses the
server's AWS CLI and the instance role (no keys); the backup bucket's lifecycle rule deletes dumps
after 30 days (infra/aws). Run it nightly from the server's crontab (`crontab -e`), in Mongolia's
night (cron runs in the server's time zone, UTC by default):

```cron
15 19 * * * /home/ubuntu/commerce/infra/backup/backup.sh s3://<backup-bucket>/nightly >> /home/ubuntu/backup.log 2>&1
```

Check a backup restores (a restore drill, e.g. monthly):

```sh
aws s3 ls s3://<backup-bucket>/nightly/
infra/backup/restore.sh s3://<backup-bucket>/nightly/commerce-<time>.dump   # into commerce_restore
```

`restore.sh` drops and re-creates the target database (default `commerce_restore`, never the
live one) and prints its user and order counts. To recover the live database: stop `api` and
`worker`, run `restore.sh <dump> commerce`, start them again. Both scripts honor
`AWS_ENDPOINT_URL` (try them against a local S3 server) and `COMPOSE_PROJECT_NAME`.

## Health checks

- `GET /health/live`: 200 while the process serves requests (the image's Docker healthcheck).
- `GET /health/ready`: 200 when the database answers too, 503 otherwise (for a load balancer).

Both are served by the API on port 4000; the `web` image does not expose them.

## Media on AWS S3 (ADR-0014 checklist)

1. Create the bucket; remove `AWS_S3_ENDPOINT_URL` and set `AWS_S3_REGION_NAME`.
2. Give the API an IAM user or role allowed `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject` and
   `s3:ListBucket` (plus `s3:CreateBucket` if `create-media-bucket` should create it). With a role,
   leave `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` unset.
3. Make the objects publicly readable (a bucket policy allowing `s3:GetObject`, or CloudFront in
   front of a private bucket) and set `MEDIA_PUBLIC_URL` to that public base URL.
4. Remove the `/media/` block from the nginx config if nothing else uses it.
