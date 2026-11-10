# ADR-0014: Product media in S3-compatible storage, thumbnails on demand with sharp

Status: Proposed (2026-11-10). Owner choices recorded the same day: S3 from the start, an S3
server in docker-compose for dev and tests, resizing with `sharp`, JPEG/PNG/WebP/GIF up to 10 MB.

## Context
M2.5 adds product images (Saleor's `ProductMedia`). Production will run on AWS S3 (owner,
2026-11-09; region Seoul/Tokyo, CloudFront later). Dev and tests need the same S3 API locally,
against a real server (as the API tests use a real Postgres, no mocks). MinIO, the usual choice,
stopped publishing images in October 2025 and its community edition is archived. Saleor serves
resized thumbnails: `ProductMedia.url(size:)` returns a stored thumbnail's URL, or a
`/thumbnail/<id>/<size>/` proxy URL that creates it on first request (`saleor/thumbnail/`).

## Decision
- **One small interface, one implementation.** `apps/api/src/storage/` exposes
  `putObject(key, body, contentType)`, `getObject(key)`, `deleteObject(key)`, `publicUrl(key)`
  and `ensureBucket()`. It is implemented once with `@aws-sdk/client-s3`, which talks to AWS S3
  and to the local server alike (`forcePathStyle` for the local one). No local-disk
  implementation: dev and tests use the real S3 API.
- **Local S3 server: SeaweedFS** (`chrislusf/seaweedfs`, pinned) in `docker-compose.yml` as
  service `s3` on `localhost:8333`. Its `infra/seaweedfs/s3.json` holds dev-only credentials and
  grants anonymous read (so image URLs work in the browser) but no anonymous write.
- **Configuration** (Saleor's variable names where they exist): `AWS_MEDIA_BUCKET_NAME`,
  `AWS_S3_ENDPOINT_URL` (unset for AWS), `AWS_S3_REGION_NAME`, `AWS_ACCESS_KEY_ID`,
  `AWS_SECRET_ACCESS_KEY`, plus ours `MEDIA_PUBLIC_URL` (the base URL objects are served from:
  `http://localhost:8333/<bucket>` in dev, the CloudFront/S3 URL in production). Tests use
  `AWS_MEDIA_BUCKET_NAME_TEST`, which must end in `-test` (as the test database must end in
  `_test`); the test setup creates it if missing. `pnpm cli create-media-bucket` creates the dev one.
- **Keys:** originals at `products/<productId>/<uuid>.<ext>`, thumbnails at
  `thumbnails/<mediaId>/<size>.<format>`. Keys never contain user input.
- **Upload path:** GraphQL multipart (`productMediaCreate(input: {product, image: Upload, alt})`,
  M2 decision 6) through the API, which validates and then writes to S3. Limits: 10 MB; the type is
  checked from the file's magic bytes (JPEG, PNG, WebP, GIF), never from its name or the browser's
  `Content-Type`; failures are Saleor's `INVALID_FILE_TYPE` / `UNSUPPORTED_MIME_TYPE` /
  `FILE_SIZE_LIMIT_EXCEEDED`. The image is decoded by `sharp` on upload to reject corrupt files.
- **Thumbnails as Saleor:** sizes `[32, 64, 128, 256, 512, 1024, 2048, 4096]`, a requested size
  rounds to the closest one; formats original or `WEBP`/`AVIF` (`ThumbnailFormatEnum`). A
  `product_media_thumbnail(media_id, size, format, key)` table records generated ones.
  `ProductMedia.url(size, format)` returns the thumbnail's public URL when it exists, otherwise
  the API's `GET /thumbnail/<mediaGlobalId>/<size>/[<format>/]`, which generates it with `sharp`
  (fit inside, no upscaling), stores it, records it and redirects (302) to it. Without `size`,
  `url` is the original's public URL.
- **Deleting** a media row deletes its object and its thumbnails' objects after the DB
  transaction commits; a failed object delete is logged, never rolled back into the DB (an orphan
  object is harmless; a row pointing at a missing object is not).

## Alternatives
- **Local disk first, S3 later:** less setup now, but two implementations and the S3 path only
  tested at deploy time. Rejected by the owner.
- **RustFS / Garage / the last MinIO image** as the local server: RustFS is younger, Garage needs
  more setup (layouts, keys), the last MinIO image gets no security fixes.
- **Presigned browser uploads straight to S3:** fewer bytes through the API, but validation moves
  to a second step and Saleor uploads through the API. Revisit if uploads become large.
- **Thumbnails at upload time:** simpler endpoint-free design, but generates sizes nobody asks for;
  Saleor's on-demand scheme is equally small with the table.

## Consequences
- + Dev, tests and production use the same code path and the same S3 API.
- + Saleor-compatible `url(size:)` behaviour; the dashboard can request the sizes it shows.
- − Two new dependencies (`@aws-sdk/client-s3`, `sharp` with a native binary) and a second
  container; `pnpm db:up` now starts both.
- − The thumbnail endpoint does CPU work on first request; acceptable at our scale, rate limiting
  comes with M9.
- − In production the bucket's public read (or CloudFront) and credentials are the owner's setup
  (checklist in M9).
