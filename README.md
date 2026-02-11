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

## Milestone coverage

Current implementation covers M0, M1, and M2 by providing:

- monorepo workspace bootstrap
- web app and ETL entrypoints
- database migrations + seed tooling for core schema
- ETL ingestion runner with advisory lock, source checksums, run lifecycle logging, and reject logging
- GeoNames ZIP metadata ingest into `dim_zip`
- Redfin gzipped TSV ingest into `fact_zip_market_monthly`
- lint/typecheck/test scripts across workspaces
- theme provider baseline with `light` / `dark` / `system` support
- CI baseline workflow for install + lint + typecheck
