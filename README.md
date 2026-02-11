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

## Environment variables

Copy `.env.example` to `.env.local` for local app configuration.

```bash
cp .env.example .env.local
```

## Milestone coverage

This baseline satisfies M0 by providing:

- monorepo workspace bootstrap
- web app and ETL entrypoints
- package scaffolds for shared and db code
- lint/typecheck/test scripts across workspaces
- theme provider baseline with `light` / `dark` / `system` support
- CI baseline workflow for install + lint + typecheck

