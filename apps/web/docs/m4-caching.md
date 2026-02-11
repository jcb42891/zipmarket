# M4 API Caching Strategy

This document defines API cache behavior for the M4 dashboard endpoints.

## Scope

- `GET /api/v1/dashboard/{zip}`
- `GET /api/v1/zips/{zip}/suggestions`

## Cache backend

- Runtime cache client: Upstash Redis REST API (`REDIS_URL`, `REDIS_TOKEN`)
- Fallback behavior when Redis is not configured:
  - API remains functional
  - responses are computed from Postgres on each request
  - caching becomes a no-op

## Cache keys

Namespace prefix:

- `zipmarket:m4`

Dashboard payload key:

- `zipmarket:m4:dashboard:{data_version}:{zip}:{segment}:{months}`

Suggestions payload key:

- `zipmarket:m4:suggestions:{data_version}:{zip}`

## Versioned invalidation

Cache invalidation is controlled through `CACHE_DATA_VERSION`.

- Default: `1`
- To invalidate all dashboard/suggestion entries after data refresh:
  1. bump `CACHE_DATA_VERSION` in runtime environment
  2. deploy/restart API runtime

Because `CACHE_DATA_VERSION` is embedded in keys, old entries become unreachable immediately without a Redis-wide delete.

## TTL and headers

- Redis TTL:
  - dashboard payloads: 3600 seconds
  - suggestions payloads: 3600 seconds
- HTTP headers on cacheable responses:
  - `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`
  - `ETag` generated from `data_version + JSON payload`

If `If-None-Match` matches the generated ETag, API returns `304 Not Modified`.
