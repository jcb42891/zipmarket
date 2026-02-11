# ZipMarket

ZipMarket is an NJ ZIP-code housing market intelligence product. This repository is a monorepo containing:

- `apps/web`: Next.js web app (UI + API surface)
- `apps/etl`: ETL CLI package for source ingestion jobs
- `packages/db`: database schema and migration utilities (scaffold)
- `packages/shared`: shared types, schemas, and constants
- `infra/github-actions`: workflow templates and references
- `data/fixtures`: local data fixtures for tests

## Prerequisites

- Node.js 22 LTS
- npm 10+

## Quickstart

```bash
npm install
npm run lint
npm run typecheck
npm run dev
```

In a separate terminal:

```bash
npm run etl -- --help
```

## Local database (Postgres + PostGIS)

```bash
npm run db:up
npm run db:migrate
npm run db:seed
npm run db:refresh-marts
```

Use `npm run db:down` to stop the local database service.

## ETL commands

```bash
npm run etl -- --help
npm run etl:geonames
npm run etl:redfin
npm run etl:run-all
```

## Environment variables

Copy `.env.example` to `.env.local` for local app configuration.

```bash
cp .env.example .env.local
```

## API endpoints (M4)

- `GET /api/v1/dashboard/{zip}?segment=all&months=36`
- `GET /api/v1/zips/{zip}/suggestions`

Caching strategy and invalidation notes are documented in `apps/web/docs/m4-caching.md`.

## Milestone coverage

Current implementation covers M0 through M4 by providing:

- monorepo workspace bootstrap
- web app and ETL entrypoints
- database migrations + seed tooling for core schema
- ETL ingestion runner with advisory lock, source checksums, run lifecycle logging, and reject logging
- GeoNames ZIP metadata ingest into `dim_zip`
- Redfin gzipped TSV ingest into `fact_zip_market_monthly`
- Redfin data quality checks (hard-fail thresholds + warning signals) and report output
- ZIP support-state recomputation (`is_supported`, `support_reason`) based on trailing data quality criteria
- Mart refresh support logic for latest KPI snapshot + 36-month trailing series
- Competitiveness score/label/explanation derivation in precomputed marts
- PostGIS nearest-supported ZIP lookup function for unsupported ZIP fallback flows
- Dashboard + suggestions API endpoints with ZIP/query validation and consistent error envelopes
- Zod-guarded API response contracts for supported/unsupported/error states
- Redis-backed API cache key strategy with data-version invalidation, `Cache-Control`, and `ETag` handling
- API route/unit test coverage for supported ZIP, unsupported NJ ZIP, non-NJ ZIP, invalid ZIP format, and suggestions
- lint/typecheck/test scripts across workspaces
- theme provider baseline with `light` / `dark` / `system` support
- CI baseline workflow for install + lint + typecheck
