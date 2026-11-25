#!/bin/sh
# Builds the storefront and starts its standalone server, the way the Dockerfile's `storefront`
# target does: .next/static (and public/, if the app has one) sit next to server.js. The
# environment comes from playwright.config.ts.
set -e
app=../apps/storefront
pnpm --filter @commerce/storefront build
standalone="$app/.next/standalone/apps/storefront"
rm -rf "$standalone/.next/static"
mkdir -p "$standalone/.next"
cp -R "$app/.next/static" "$standalone/.next/static"
if [ -d "$app/public" ]; then
  rm -rf "$standalone/public"
  cp -R "$app/public" "$standalone/public"
fi
exec node "$standalone/server.js"
