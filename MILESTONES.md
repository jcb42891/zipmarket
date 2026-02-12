# ZipMarket MVP Milestones

Version: 1.0  
Date: February 7, 2026  
Primary references: `PRD.md`, `SPEC.md`

## 1. How to use this document

This file is the implementation execution log and handoff guide from zero setup to MVP launch.

Rules for continuity:

1. At the end of each work session, update the milestone status table in Section 3.
2. For the current active milestone, fill the handoff template in Section 4.
3. Do not start a milestone unless its entry criteria are met.
4. A milestone is done only when its exit criteria and verification checks pass.

## 2. Current decisions and constraints

- Geography: New Jersey ZIP codes only (MVP).
- Data source (market metrics): Redfin ZIP market tracker feed.
- Data source (ZIP metadata + coordinates): GeoNames US postal feed.
- MVP segmentation: property type only (`all`, `single_family`, `condo_coop`, `townhouse`).
- Out of MVP: bedroom segmentation and true price-band segmentation.
- Design bar: sleek, modern, easy-to-digest UI is a hard requirement.
- Theme requirement: full light and dark mode parity across all pages and chart states.
- Performance targets:
- API p95 < 250 ms
- dashboard load p95 < 500 ms (warm cache)

## 3. Milestone status board

Update this table as work progresses.

| Milestone | Name | Owner | Status | Start Date | End Date | Notes |
|---|---|---|---|---|---|---|
| M0 | Local setup and repo bootstrap | Codex | Done | 2026-02-11 | 2026-02-11 | Monorepo scaffold, web + ETL entrypoints, theme baseline, CI baseline complete. |
| M1 | Database foundation and schema | Codex | Done | 2026-02-10 | 2026-02-10 | Schema/migrations/seeds complete with local Docker PostGIS verification (migrate, seed, tables/indexes, idempotent rerun) on port 5433. |
| M2 | ETL scaffolding and source ingestion | Codex | Done | 2026-02-10 | 2026-02-10 | ETL runner, source snapshots/checksums, advisory locks, GeoNames + Redfin ingests, reject logging, and local idempotency verification complete. |
| M3 | Data marts, derived metrics, and support logic | Codex | Done | 2026-02-10 | 2026-02-10 | Added marts/support SQL functions, nearest ZIP lookup, Redfin DQ gates/reporting, and verified live ingest + mart refresh on Docker PostGIS. |
| M4 | API layer and caching | Codex | Done | 2026-02-10 | 2026-02-11 | Added dashboard/suggestions API routes with Zod contract guards, Redis cache versioning strategy, ETag/cache-control handling, route/service/cache tests, and local endpoint verification. |
| M5 | Frontend shell and ZIP search flows | Codex | Done | 2026-02-11 | 2026-02-11 | Homepage and `/zip/[zip]` shell flows, persistent search/disclaimer, and theme-aware dashboard state handling shipped in commit `58c9cc3`. |
| M6 | Dashboard charts, segmentation, and indicator UX | Codex | Ready for Review | 2026-02-11 |  | KPI deltas, chart suite, segment controls, competitiveness card, and finalized metric tooltip copy implemented with unit coverage. |
| M7 | Reliability, observability, and security hardening | TBD | Not Started |  |  |  |
| M8 | QA, performance validation, and release readiness | TBD | Not Started |  |  |  |
| M9 | MVP launch and post-launch stabilization | TBD | Not Started |  |  |  |

Status values:

- `Not Started`
- `In Progress`
- `Blocked`
- `Ready for Review`
- `Done`

## 4. Session handoff template

Copy this block at the bottom of the file each time work stops.

```
### Handoff - YYYY-MM-DD HH:MM (local)

- Active milestone: M?
- Branch:
- Last commit:
- Completed since last handoff:
  - ...
- In progress:
  - ...
- Blockers/risks:
  - ...
- Decisions made:
  - ...
- Files changed:
  - ...
- Commands run for verification:
  - ...
- Next exact step:
  - ...
```

## 5. Milestone details

## M0. Local setup and repo bootstrap

Goal:

- Create a runnable monorepo baseline for web app, ETL jobs, shared packages, and DB package.

Entry criteria:

- `PRD.md` and `SPEC.md` exist and are approved for implementation.

Tasks:

1. Initialize workspace structure from `SPEC.md` section 6.3.
2. Set up package manager (`npm` workspaces) and base scripts.
3. Create `apps/web` with Next.js + TypeScript + Tailwind.
4. Create `apps/etl` TypeScript CLI package.
5. Create `packages/db` and `packages/shared`.
6. Add base lint/typecheck/test scripts for all packages.
7. Add `.env.example` with all required env vars from `SPEC.md`.
8. Add README section: local prerequisites and quickstart.
9. Add frontend token scaffold (CSS variables) and theme provider wiring (`light`, `dark`, `system`).

Deliverables:

- Workspace directories and lockfile
- Running `npm run dev` in `apps/web`
- Running `npm run etl -- --help` (or equivalent)
- CI baseline workflow (install + lint + typecheck)
- Theme provider baseline with a working mode toggle placeholder

Verification:

- `npm install`
- `npm run lint`
- `npm run typecheck`
- `npm run dev` (web loads locally)

Exit criteria:

- Any engineer can clone, install, and run web and ETL entrypoints without manual patching.

## M1. Database foundation and schema

Goal:

- Implement database schema, migrations, and local database bootstrap with PostGIS.

Entry criteria:

- M0 complete.

Tasks:

1. Provision local Postgres 16 with PostGIS (Docker compose preferred).
2. Implement schema in `packages/db`:
- `dim_zip`
- `dim_property_type`
- `fact_zip_market_monthly`
- `mart_zip_dashboard_latest`
- `ingestion_run`
3. Add migration scripts and migration README.
4. Add seed script for property type dimension.
5. Add indexes from `SPEC.md`.

Deliverables:

- Migration files in source control
- Seed scripts and DB helper scripts
- Local DB startup docs and commands

Verification:

- `npm run db:migrate`
- `npm run db:seed`
- SQL check for all expected tables and indexes

Exit criteria:

- Fresh DB can be fully rebuilt from migrations and seeds, repeatably.

## M2. ETL scaffolding and source ingestion

Goal:

- Ingest GeoNames and Redfin sources into normalized DB tables with idempotent runs.

Entry criteria:

- M1 complete.

Tasks:

1. Implement ETL runner framework:
- source download
- checksum capture
- advisory lock
- ingestion_run lifecycle
2. Implement GeoNames ingest:
- parse `US.txt`
- upsert ZIP metadata
- compute `geog` points
3. Implement Redfin ingest:
- stream parse gzipped TSV
- filter to NJ + ZIP + non-seasonally-adjusted rows
- map property types
- convert `NA` -> NULL
4. Implement reject logging and run summaries.
5. Persist raw source snapshot metadata (URL, checksum, timestamp).

Deliverables:

- `apps/etl` commands:
- `etl:geonames`
- `etl:redfin`
- `etl:run-all`
- Ingestion logs with row counts and error counts

Verification:

- Run ETL twice; second run is idempotent (no duplicate facts).
- Confirm expected NJ ZIP coverage and date ranges.

Exit criteria:

- Both sources ingest reliably and produce stable fact/dimension rows.

## M3. Data marts, derived metrics, and support logic

Goal:

- Build read-optimized marts and ZIP support-state logic used by the dashboard.

Entry criteria:

- M2 complete with successful ingest.

Tasks:

1. Implement materialized views or mart tables for:
- latest KPI snapshot per ZIP and segment
- trailing time-series arrays or rowset for 36 months
2. Implement support logic (`is_supported`, `support_reason`) in `dim_zip`.
3. Implement nearest supported ZIP query using PostGIS distance.
4. Implement competitiveness score, label, explanation text generation.
5. Add data quality checks and thresholds from `SPEC.md`.

Deliverables:

- SQL/view definitions
- reproducible mart refresh script
- data quality report output

Verification:

- Spot-check 10 ZIPs (supported, unsupported, edge sparse ZIPs).
- Validate all KPI formulas against raw fact inputs.

Exit criteria:

- Dashboard queries can be fulfilled from marts/facts without heavy runtime aggregation.

## M4. API layer and caching

Goal:

- Implement public API routes for dashboard retrieval and suggestions with caching.

Entry criteria:

- M3 complete.

Tasks:

1. Build `GET /api/v1/dashboard/{zip}`:
- input validation
- NJ-only state checks
- supported/unsupported response branches
- segment and months query handling
2. Build `GET /api/v1/zips/{zip}/suggestions`.
3. Add Zod response schema guards.
4. Add Redis cache key strategy and invalidation versioning.
5. Add error envelopes and consistent status codes.

Deliverables:

- API routes in `apps/web`
- integration tests for all response states
- caching behavior docs

Verification:

- Endpoint tests:
- valid supported ZIP
- unsupported NJ ZIP
- non-NJ ZIP
- invalid ZIP format
- Load-test p95 API latency target (<250 ms).

Exit criteria:

- API contract is stable, tested, and meets latency targets on staging.

## M5. Frontend shell and ZIP search flows

Goal:

- Deliver user entry flows and base dashboard layout/state handling.

Entry criteria:

- M4 complete.

Tasks:

1. Build landing page with ZIP search input and validation messaging.
2. Build `/zip/[zip]` route shell:
- loading skeleton
- supported dashboard state shell
- unsupported NJ state + suggestions
- non-NJ and invalid states
3. Implement persistent search bar across dashboard page.
4. Add persistent disclaimer block and methodology tooltip placeholders.
5. Implement visual foundation:
- typography scale
- spacing/radius/shadow tokens
- card/container styles consistent with sleek, modern direction
6. Implement theme behavior:
- light/dark toggle in global chrome
- system preference default
- persisted user selection

Deliverables:

- functional user flow from homepage to ZIP dashboard route
- route-level tests
- reusable design tokens and base component styles used by landing + dashboard shell

Verification:

- Manual UX pass on desktop + mobile breakpoints.
- Automated smoke test for route transitions and error states.
- Verify no major contrast/readability issues in either light or dark mode.

Exit criteria:

- ZIP input flow and all core state transitions work end-to-end.

## M6. Dashboard charts, segmentation, and indicator UX

Goal:

- Implement all KPI visualizations and interactive segmentation for MVP-supported dimensions.

Entry criteria:

- M5 complete.

Tasks:

1. Add KPI strip cards:
- latest values
- MoM/YoY deltas
2. Add charts:
- list vs sale price trend
- sale-to-list trend
- sold-over-list trend
- new listings trend
- sales volume trend
3. Add segmentation control:
- all
- single-family
- condo/co-op
- townhouse
4. Add competitiveness card with explanation text.
5. Add metric-level tooltip copy from `SPEC.md`.
6. Perform UI polish pass:
- tighten information hierarchy
- reduce visual noise
- ensure chart legends, axes, and tooltips are readable in both themes

Deliverables:

- complete dashboard UI matching MVP metric scope
- visual regression snapshots (optional but recommended)
- polished, consistent dashboard visuals with light/dark parity

Verification:

- Data-binding tests for each KPI and chart.
- Manual checks for metric formatting and null handling.
- Visual QA pass in both themes on desktop and mobile.

Exit criteria:

- Dashboard fully answers core user questions in PRD for supported ZIPs.

## M7. Reliability, observability, and security hardening

Goal:

- Add production safeguards around ETL, APIs, and runtime operations.

Entry criteria:

- M6 complete.

Tasks:

1. Add structured logging fields for API and ETL.
2. Add Sentry instrumentation for web/API and ETL jobs.
3. Add alerts:
- ETL failure
- data freshness breach
- 5xx spikes
4. Add rate limiting for public endpoints.
5. Validate secret management and rotate any test credentials.
6. Add runbook docs for ETL rerun and cache/version rollback.

Deliverables:

- observability dashboards and alert policies
- runbook markdown docs

Verification:

- Trigger test failures and confirm alert delivery.
- Confirm sensitive values are never logged.

Exit criteria:

- Operationally safe to run unattended with clear incident response path.

## M8. QA, performance validation, and release readiness

Goal:

- Prove MVP quality with automated and manual validation, then freeze release candidate.

Entry criteria:

- M7 complete.

Tasks:

1. Finalize unit, integration, and E2E test coverage for critical flows.
2. Execute performance tests against staging data.
3. Validate all acceptance criteria in `SPEC.md` Section 20.
4. Complete legal attribution and source-terms checklist.
5. Run accessibility pass for key flows (search, dashboard, tooltips).
6. Run dedicated design QA checklist:
- visual consistency across pages/components
- light/dark parity for all states
- readability and scan-ability of KPI and chart-heavy screens

Deliverables:

- test report artifact
- performance report artifact
- release checklist signoff

Verification:

- CI green on main branch.
- No open P0/P1 defects.
- No open P1 design defects and no unresolved theme parity issues.

Exit criteria:

- Release candidate approved for production deployment.

## M9. MVP launch and post-launch stabilization

Goal:

- Deploy MVP to production, monitor behavior, and resolve immediate launch issues.

Entry criteria:

- M8 complete and release approval granted.

Tasks:

1. Deploy web/API and run one final data refresh.
2. Verify production health checks and endpoint sanity checks.
3. Monitor first 72 hours:
- latency
- error rates
- ETL freshness
- cache hit ratio
4. Triage and fix launch regressions.
5. Publish post-launch summary and backlog priorities.

Deliverables:

- production deployment record
- first-72-hour monitoring report
- prioritized post-MVP backlog

Verification:

- No Sev-1 incidents in first 72 hours.
- Data freshness and dashboard load targets are maintained.

Exit criteria:

- MVP considered stable; ownership transitions to iterative product improvements.

## 6. Cross-milestone dependency map

- M0 -> required for all subsequent milestones.
- M1 -> required before any ingest or API work.
- M2 -> required before marts, API, or dashboard data rendering.
- M3 -> required before API and frontend data integration.
- M4 -> required before user-facing dashboard completion.
- M5 + M6 -> required before reliability and QA hardening.
- M7 -> required before release readiness.
- M8 -> required before launch.

Critical path:

- M0 -> M1 -> M2 -> M3 -> M4 -> M5 -> M6 -> M7 -> M8 -> M9

## 7. Resume protocol (if implementation stops mid-stream)

When picking work back up:

1. Read latest handoff block in Section 4.
2. Check `git status` and branch consistency.
3. Run baseline verification:
- install deps
- run migrations
- run tests
4. Reconfirm active milestone entry criteria.
5. Continue from the "Next exact step" in handoff.

If handoff data is stale or missing:

1. Start at nearest completed milestone in Section 3.
2. Re-run milestone verification commands.
3. Open new handoff block before making additional changes.

## 8. Open decisions to resolve before/early in execution

1. Hosting choices final confirmation:
- Supabase vs alternative managed Postgres
- Upstash Redis plan tier

2. Legal and attribution confirmation:
- Redfin data usage language
- GeoNames attribution placement

3. Source freshness policy:
- daily refresh schedule confirmation
- fallback behavior if source not updated for >35 days

4. UI copy lock:
- unsupported ZIP message final wording
- competitiveness explanation tone and wording

5. Visual direction lock:
- final type scale and font pairing
- final color token palette for light and dark modes

### Handoff - 2026-02-10 21:04 (local)

- Active milestone: M0
- Branch: main
- Last commit: 89a2bdd
- Completed since last handoff:
  - Installed dependencies and generated lockfile.
  - Fixed workspace linting by aligning ESLint to v8 and setting `tsconfigRootDir` in root ESLint config.
  - Switched web lint to ESLint CLI and excluded `next-env.d.ts`.
  - Fixed web type import in theme provider.
  - Verified `npm run lint`, `npm run typecheck`, `npm run test`, `npm run etl -- --help`, and `npm run dev` startup.
- In progress:
  - None.
- Blockers/risks:
  - Node engine warning appears locally on Node 24 because project target is Node 22 LTS.
- Decisions made:
  - Keep Node 22 as the project runtime target for MVP.
  - Keep generated Next typed-route reference in `next-env.d.ts`.
- Files changed:
  - `.eslintrc.cjs`
  - `.gitignore`
  - `package.json`
  - `package-lock.json`
  - `apps/web/package.json`
  - `apps/web/components/theme-provider.tsx`
  - `apps/web/next-env.d.ts`
  - `apps/web/tsconfig.json`
  - `MILESTONES.md`
- Commands run for verification:
  - `npm install`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test`
  - `npm run etl -- --help`
  - `npm run dev`
- Next exact step:
  - Start M1 (database foundation and schema) on a new PR branch.

### Handoff - 2026-02-10 21:18 (local)

- Active milestone: M1
- Branch: m1-database-foundation
- Last commit: 89a2bdd
- Completed since last handoff:
  - Added local Postgres + PostGIS bootstrap via `docker-compose.yml`.
  - Implemented `packages/db` migration SQL for `dim_zip`, `dim_property_type`, `fact_zip_market_monthly`, `mart_zip_dashboard_latest`, and `ingestion_run`.
  - Added migration runner with checksum tracking table (`_zipmarket_migrations`).
  - Added idempotent property-type seed runner for `dim_property_type`.
  - Added `db:up`, `db:down`, `db:migrate`, `db:seed` scripts at repo root and workspace package scripts.
  - Added DB workflow docs in `packages/db/README.md` and root README DB quickstart section.
  - Added unit tests for env resolution, migration discovery/application behavior, seed behavior, and required schema/index assertions in migration SQL.
- In progress:
  - None.
- Blockers/risks:
  - Docker CLI is not available in this environment, so `npm run db:up` cannot run locally here.
  - Existing local Postgres at `127.0.0.1:5432` rejects default `zipmarket` credentials, so `npm run db:migrate` and `npm run db:seed` cannot be completed against that host without credential alignment.
- Decisions made:
  - Keep M1 implementation in a single PR because scope stays inside DB package + local DB bootstrap/docs.
  - Use SQL-first migrations with checksum locking to keep rebuilds deterministic.
- Files changed:
  - `.env.example`
  - `README.md`
  - `docker-compose.yml`
  - `package.json`
  - `package-lock.json`
  - `packages/db/package.json`
  - `packages/db/README.md`
  - `packages/db/migrations/0001_init_schema.sql`
  - `packages/db/src/index.ts`
  - `packages/db/src/env.ts`
  - `packages/db/src/pg-client.ts`
  - `packages/db/src/migrations.ts`
  - `packages/db/src/migrate.ts`
  - `packages/db/src/property-type-seed.ts`
  - `packages/db/src/seed.ts`
  - `packages/db/src/cli/migrate.ts`
  - `packages/db/src/cli/seed.ts`
  - `packages/db/src/env.test.ts`
  - `packages/db/src/migrations.test.ts`
  - `packages/db/src/migrate.test.ts`
  - `packages/db/src/seed.test.ts`
  - `packages/db/src/schema-sql.test.ts`
  - `MILESTONES.md`
- Commands run for verification:
  - `npm install`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test`
  - `npm run db:up` (fails locally: `docker` command not found)
  - `npm run db:migrate` (fails locally: Postgres auth for user `zipmarket`)
  - `npm run db:seed` (fails locally: Postgres auth for user `zipmarket`)
- Next exact step:
  - Run `npm run db:up && npm run db:migrate && npm run db:seed` on a machine with Docker/PostGIS and matching DB credentials, then execute the SQL table/index checks in `packages/db/README.md`.

### Handoff - 2026-02-10 21:32 (local)

- Active milestone: M1
- Branch: m1-database-foundation
- Last commit: 89a2bdd
- Completed since last handoff:
  - Installed Docker Desktop and WSL runtime; after reboot, verified Docker engine health.
  - Identified host Postgres conflict on `127.0.0.1:5432` and moved local Docker mapping/default DB URL to `5433`.
  - Verified `npm run db:up`, `npm run db:migrate`, and `npm run db:seed` against Docker PostGIS.
  - Verified expected M1 tables and indexes through SQL checks.
  - Re-ran migration and seed to confirm idempotent behavior (`Applied=0 Skipped=1`, seeded rows remain 5).
  - Re-ran `npm run lint`, `npm run typecheck`, and `npm run test` with all checks passing.
- In progress:
  - None.
- Blockers/risks:
  - None for M1.
- Decisions made:
  - Keep local Docker PostGIS on host port `5433` to avoid collisions with an existing local Postgres service on `5432`.
- Files changed:
  - `.env.example`
  - `docker-compose.yml`
  - `packages/db/README.md`
  - `packages/db/src/env.ts`
  - `MILESTONES.md`
- Commands run for verification:
  - `docker --version`
  - `docker compose version`
  - `docker info`
  - `npm run db:down`
  - `npm run db:up`
  - `npm run db:migrate`
  - `npm run db:seed`
  - `psql -w -h 127.0.0.1 -p 5433 -U zipmarket -d zipmarket -c "SELECT property_type_key, source_property_type, is_mvp_exposed FROM dim_property_type ORDER BY property_type_key;"`
  - `psql -w -h 127.0.0.1 -p 5433 -U zipmarket -d zipmarket -c "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('dim_zip','dim_property_type','fact_zip_market_monthly','mart_zip_dashboard_latest','ingestion_run') ORDER BY tablename;"`
  - `psql -w -h 127.0.0.1 -p 5433 -U zipmarket -d zipmarket -c "SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname IN ('idx_fact_zip_market_monthly_zip_property_period_end_desc','idx_fact_zip_market_monthly_period_end_desc','idx_dim_zip_is_supported_is_nj','idx_dim_zip_geog_gist') ORDER BY indexname;"`
  - `npm run db:migrate`
  - `npm run db:seed`
  - `psql -w -h 127.0.0.1 -p 5433 -U zipmarket -d zipmarket -c "SELECT COUNT(*) AS property_type_count FROM dim_property_type;"`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test`
- Next exact step:
  - Start M2 (ETL scaffolding and source ingestion) on a new PR branch.

### Handoff - 2026-02-10 22:07 (local)

- Active milestone: M2
- Branch: m1-database-foundation
- Last commit: efc8b00
- Completed since last handoff:
  - Added M2 migration `0002_ingestion_metadata.sql` with `source_snapshot` and `ingestion_reject` tables/indexes.
  - Implemented ETL framework in `apps/etl` with advisory lock, source download + SHA-256 checksum capture, `ingestion_run` lifecycle, reject logging, and source snapshot persistence.
  - Implemented GeoNames ingest (`US.zip` -> `US.txt`) with ZIP metadata normalization and `dim_zip` upserts (including PostGIS geography point generation).
  - Implemented Redfin ingest (gzipped TSV streaming parse) with NJ/ZIP/non-seasonal filters, property-type mapping, `NA` -> `NULL` normalization, metadata cross-checks against `dim_zip`, and fact upserts.
  - Replaced ETL placeholder CLI with runnable commands and added root scripts: `etl:geonames`, `etl:redfin`, `etl:run-all`.
  - Added unit tests for ETL env/config, source download, framework lifecycle, CLI dispatch, GeoNames parser/ingest logic, Redfin parser/ingest logic, plus DB migration SQL assertions for M2.
  - Verified live local ingest runs on Docker PostGIS (`geonames` twice, `redfin` twice) and confirmed no duplicate fact PK rows after rerun.
- In progress:
  - None.
- Blockers/risks:
  - Redfin ingestion currently performs row-level upserts and takes several minutes per full run; batching/staging optimization may be needed in a later milestone if runtime becomes a scheduling risk.
- Decisions made:
  - Normalize quoted Redfin headers/cells from the live feed so parser behavior matches production schema shape.
  - Keep ETL writes idempotent with `ON CONFLICT` upserts and rely on PK uniqueness checks for duplicate prevention verification.
- Files changed:
  - `README.md`
  - `package.json`
  - `package-lock.json`
  - `apps/etl/package.json`
  - `apps/etl/src/cli.ts`
  - `apps/etl/src/env.ts`
  - `apps/etl/src/source-download.ts`
  - `apps/etl/src/framework.ts`
  - `apps/etl/src/line-reader.ts`
  - `apps/etl/src/geonames.ts`
  - `apps/etl/src/redfin.ts`
  - `apps/etl/src/cli.test.ts`
  - `apps/etl/src/env.test.ts`
  - `apps/etl/src/source-download.test.ts`
  - `apps/etl/src/framework.test.ts`
  - `apps/etl/src/geonames.test.ts`
  - `apps/etl/src/redfin.test.ts`
  - `packages/db/migrations/0002_ingestion_metadata.sql`
  - `packages/db/src/ingestion-metadata-sql.test.ts`
  - `packages/db/README.md`
  - `MILESTONES.md`
- Commands run for verification:
  - `npm install`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test`
  - `npm run db:up`
  - `npm run db:migrate`
  - `npm run db:seed`
  - `npm run etl -- --help`
  - `npm run etl:geonames` (run twice)
  - `npm run etl:redfin` (run three times: first failed due strict header parsing before quoted-header fix, then two successful runs)
  - `docker compose exec -T db psql -U zipmarket -d zipmarket -c "SELECT run_id, source_name, status, started_at, finished_at, rows_read, rows_written, rows_rejected FROM ingestion_run ORDER BY started_at DESC LIMIT 5;"`
  - `docker compose exec -T db psql -U zipmarket -d zipmarket -c "SELECT COUNT(*) AS fact_rows, COUNT(DISTINCT (zip_code, period_end, property_type_key)) AS distinct_pk_rows FROM fact_zip_market_monthly;"`
  - `docker compose exec -T db psql -U zipmarket -d zipmarket -c "SELECT COUNT(*) AS dim_zip_rows, COUNT(DISTINCT zip_code) AS distinct_zip_rows, COUNT(*) FILTER (WHERE is_nj) AS nj_zip_rows FROM dim_zip;"`
  - `docker compose exec -T db psql -U zipmarket -d zipmarket -c "SELECT COUNT(DISTINCT zip_code) FILTER (WHERE property_type_key = 'all') AS all_segment_zip_count, MIN(period_end) AS min_period_end, MAX(period_end) AS max_period_end FROM fact_zip_market_monthly;"`
  - `docker compose exec -T db psql -U zipmarket -d zipmarket -c "SELECT COUNT(*) AS non_nj_fact_rows FROM fact_zip_market_monthly fact JOIN dim_zip zip ON zip.zip_code = fact.zip_code WHERE zip.state_code <> 'NJ';"`
  - `docker compose exec -T db psql -U zipmarket -d zipmarket -c "SELECT source_name, COUNT(*) AS run_count, SUM(rows_read) AS rows_read_total, SUM(rows_written) AS rows_written_total, SUM(rows_rejected) AS rows_rejected_total FROM ingestion_run GROUP BY source_name ORDER BY source_name;"`
  - `docker compose exec -T db psql -U zipmarket -d zipmarket -c "SELECT COUNT(*) AS source_snapshot_rows FROM source_snapshot; SELECT COUNT(*) AS ingestion_reject_rows FROM ingestion_reject;"`
- Next exact step:
  - Start M3 (data marts, derived metrics, and support logic) on a new PR branch.

### Handoff - 2026-02-10 22:37 (local)

- Active milestone: M3
- Branch: m2
- Last commit: 7e28e62
- Completed since last handoff:
  - Added M3 migration `0003_m3_data_marts_and_support_logic.sql` with:
    - `mart_zip_dashboard_series` table and index for trailing rowset reads.
    - `refresh_zipmarket_marts()` to recompute `dim_zip.is_supported/support_reason` and rebuild latest + 36-month marts.
    - competitiveness helper SQL functions (`score`, `label`, `explanation`, `confidence_tier`).
    - `find_nearest_supported_zips()` PostGIS + numeric fallback lookup.
  - Added DB runtime support for marts:
    - `packages/db/src/marts.ts` helper (`refreshMarts`, `findNearestSupportedZips`).
    - `packages/db/src/cli/refresh-marts.ts` CLI entrypoint.
    - root/workspace scripts: `db:refresh-marts`.
  - Integrated Redfin M3 post-ingest flow:
    - new `apps/etl/src/redfin-data-quality.ts` implementing SPEC 8.4 gates (hard fail + warnings).
    - `runRedfinIngestion` now runs DQ evaluation and mart refresh before marking run success.
    - ETL CLI now prints DQ report output and mart refresh summary.
  - Added unit tests for all new code paths:
    - DB migration assertions + marts helper tests.
    - Redfin DQ evaluator tests.
    - CLI test coverage for redfin DQ/mart logs.
  - Updated documentation (`README.md`, `packages/db/README.md`) for M3 capabilities and commands.
- In progress:
  - None.
- Blockers/risks:
  - Redfin ingestion remains row-level upsert and still takes several minutes per full run; batching/staging may be needed if runtime SLO pressure increases.
- Decisions made:
  - M3 was split into three PR-sized tracks (schema/refresh foundation, ETL DQ integration, tests/docs) and implemented sequentially in this session.
  - Used deterministic table-refresh marts via SQL function instead of materialized view refresh concurrency for simpler reproducibility.
  - Treated parse error rate and latest-period regression as hard-fail gates; row-count drops/core metric coverage/unknown property types as warnings.
- Files changed:
  - `README.md`
  - `package.json`
  - `apps/etl/src/cli.ts`
  - `apps/etl/src/cli.test.ts`
  - `apps/etl/src/redfin.ts`
  - `apps/etl/src/redfin-data-quality.ts`
  - `apps/etl/src/redfin-data-quality.test.ts`
  - `packages/db/package.json`
  - `packages/db/README.md`
  - `packages/db/migrations/0003_m3_data_marts_and_support_logic.sql`
  - `packages/db/src/index.ts`
  - `packages/db/src/marts.ts`
  - `packages/db/src/marts.test.ts`
  - `packages/db/src/m3-marts-sql.test.ts`
  - `packages/db/src/cli/refresh-marts.ts`
  - `MILESTONES.md`
- Commands run for verification:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test`
  - `npm run db:up`
  - `npm run db:migrate`
  - `npm run db:seed`
  - `npm run db:refresh-marts` (first attempt raced `db:migrate` when run in parallel; sequential rerun succeeded)
  - `npm run etl:geonames`
  - `npm run etl:redfin`
  - `docker compose exec -T db psql -U zipmarket -d zipmarket -c "SELECT COUNT(*) AS supported_nj_zips FROM dim_zip WHERE is_nj AND is_supported; SELECT support_reason, COUNT(*) AS zip_count FROM dim_zip WHERE is_nj AND NOT is_supported GROUP BY support_reason ORDER BY zip_count DESC;"`
  - `docker compose exec -T db psql -U zipmarket -d zipmarket -c "WITH latest AS (SELECT DISTINCT ON (zip_code, property_type_key) zip_code, property_type_key, period_end, avg_sale_to_list FROM fact_zip_market_monthly ORDER BY zip_code, property_type_key, period_end DESC) SELECT COUNT(*) AS mismatched_sale_to_list_pct FROM mart_zip_dashboard_latest mart JOIN latest ON latest.zip_code = mart.zip_code AND latest.property_type_key = mart.property_type_key WHERE (mart.sale_to_list_pct_over_under IS DISTINCT FROM ((latest.avg_sale_to_list - 1) * 100)::numeric);"`
  - `docker compose exec -T db psql -U zipmarket -d zipmarket -c "WITH latest AS (SELECT DISTINCT ON (f.zip_code, f.property_type_key) f.zip_code, f.property_type_key, f.avg_sale_to_list, f.sold_above_list, f.new_listings_yoy, f.homes_sold_yoy FROM fact_zip_market_monthly f ORDER BY f.zip_code, f.property_type_key, f.period_end DESC), expected AS (SELECT latest.zip_code, latest.property_type_key, CASE WHEN latest.avg_sale_to_list IS NULL OR latest.sold_above_list IS NULL THEN NULL ELSE (CASE WHEN latest.avg_sale_to_list >= 1.05 THEN 3 WHEN latest.avg_sale_to_list >= 1.02 THEN 2 WHEN latest.avg_sale_to_list >= 1.00 THEN 1 WHEN latest.avg_sale_to_list >= 0.98 THEN 0 ELSE -1 END) + (CASE WHEN latest.sold_above_list >= 0.60 THEN 3 WHEN latest.sold_above_list >= 0.45 THEN 2 WHEN latest.sold_above_list >= 0.30 THEN 1 WHEN latest.sold_above_list >= 0.15 THEN 0 ELSE -1 END) + (CASE WHEN latest.new_listings_yoy IS NULL THEN 0 WHEN latest.new_listings_yoy <= -0.15 THEN 2 WHEN latest.new_listings_yoy <= -0.05 THEN 1 WHEN latest.new_listings_yoy < 0.05 THEN 0 WHEN latest.new_listings_yoy < 0.15 THEN -1 ELSE -2 END) + (CASE WHEN latest.homes_sold_yoy IS NULL THEN 0 WHEN latest.homes_sold_yoy >= 0.10 THEN 1 WHEN latest.homes_sold_yoy <= -0.10 THEN -1 ELSE 0 END) END AS expected_score FROM latest) SELECT COUNT(*) AS competitiveness_score_mismatches FROM mart_zip_dashboard_latest mart JOIN expected ON expected.zip_code = mart.zip_code AND expected.property_type_key = mart.property_type_key WHERE mart.competitiveness_score IS DISTINCT FROM expected.expected_score;"`
  - `docker compose exec -T db psql -U zipmarket -d zipmarket -c "SELECT COUNT(*) AS bad_competitiveness_labels FROM mart_zip_dashboard_latest WHERE competitiveness_score IS NOT NULL AND (competitiveness_label IS DISTINCT FROM CASE WHEN competitiveness_score <= 0 THEN 'Buyer-leaning' WHEN competitiveness_score <= 3 THEN 'Balanced' WHEN competitiveness_score <= 6 THEN 'Competitive' ELSE 'Very competitive' END);"`
  - `docker compose exec -T db psql -U zipmarket -d zipmarket -c "WITH bounds AS (SELECT MAX(period_end) AS latest_period_end FROM fact_zip_market_monthly WHERE property_type_key='all') SELECT MIN(period_end) AS series_min_period, MAX(period_end) AS series_max_period, COUNT(*) FILTER (WHERE period_end < (bounds.latest_period_end - INTERVAL '35 months')::date OR period_end > bounds.latest_period_end) AS out_of_window_rows FROM mart_zip_dashboard_series, bounds;"`
  - `docker compose exec -T db psql -U zipmarket -d zipmarket -c "WITH latest_period AS (SELECT MAX(period_end) AS latest_period_end FROM fact_zip_market_monthly WHERE property_type_key='all'), latest_all AS (SELECT f.zip_code, f.median_sale_price, f.homes_sold, f.avg_sale_to_list, f.sold_above_list FROM fact_zip_market_monthly f, latest_period lp WHERE f.property_type_key='all' AND f.period_end = lp.latest_period_end), trailing_counts AS (SELECT f.zip_code, COUNT(f.period_end)::int AS trailing_month_count FROM fact_zip_market_monthly f, latest_period lp WHERE f.property_type_key='all' AND f.period_end BETWEEN (lp.latest_period_end - INTERVAL '35 months')::date AND lp.latest_period_end GROUP BY f.zip_code), expected AS (SELECT z.zip_code, CASE WHEN NOT z.is_nj THEN FALSE WHEN la.zip_code IS NULL THEN FALSE WHEN COALESCE(tc.trailing_month_count, 0) < 24 THEN FALSE WHEN la.median_sale_price IS NULL OR la.homes_sold IS NULL OR la.avg_sale_to_list IS NULL OR la.sold_above_list IS NULL THEN FALSE ELSE TRUE END AS expected_is_supported, CASE WHEN NOT z.is_nj THEN 'non_nj_zip' WHEN la.zip_code IS NULL THEN 'no_recent_data' WHEN COALESCE(tc.trailing_month_count, 0) < 24 THEN 'insufficient_history' WHEN la.median_sale_price IS NULL OR la.homes_sold IS NULL OR la.avg_sale_to_list IS NULL OR la.sold_above_list IS NULL THEN 'missing_core_metrics' ELSE NULL END AS expected_support_reason FROM dim_zip z LEFT JOIN latest_all la ON la.zip_code = z.zip_code LEFT JOIN trailing_counts tc ON tc.zip_code = z.zip_code) SELECT COUNT(*) AS support_flag_mismatches FROM dim_zip z JOIN expected e ON e.zip_code = z.zip_code WHERE z.is_supported IS DISTINCT FROM e.expected_is_supported OR z.support_reason IS DISTINCT FROM e.expected_support_reason;"`
  - `docker compose exec -T db psql -U zipmarket -d zipmarket -c "WITH unsupported AS (SELECT zip_code FROM dim_zip WHERE is_nj AND NOT is_supported ORDER BY zip_code LIMIT 1) SELECT unsupported.zip_code AS input_zip, suggestion.zip_code AS suggested_zip, suggestion.distance_miles FROM unsupported CROSS JOIN LATERAL find_nearest_supported_zips(unsupported.zip_code, 5) AS suggestion;"`
- Next exact step:
  - Start M4 (API layer and caching) on a new PR branch using the new marts and nearest ZIP SQL function as the API read surface.

### Handoff - 2026-02-10 22:53 (local)

- Active milestone: M4
- Branch: main
- Last commit: 68155e4
- Completed since last handoff:
  - Implemented `GET /api/v1/dashboard/{zip}` route in `apps/web` with ZIP/query validation (`segment`, `months`) and response-state handling for supported, unsupported, non-NJ, and not-found ZIPs.
  - Implemented `GET /api/v1/zips/{zip}/suggestions` route in `apps/web` with ZIP validation and NJ/not-found handling.
  - Added Zod API contracts/response guards and a consistent error envelope shape for 400/404/500 responses.
  - Added DB-backed dashboard/suggestions service layer that reads from `dim_zip`, `mart_zip_dashboard_latest`, `mart_zip_dashboard_series`, and `find_nearest_supported_zips`.
  - Adjusted M4 web DB access to use a local `pg` client/service implementation in `apps/web` (instead of importing runtime code from `@zipmarket/db`) to satisfy Next.js route runtime module resolution constraints.
  - Added cache module with Redis REST support, versioned key strategy (`CACHE_DATA_VERSION`), `Cache-Control`, and `ETag`/`If-None-Match` handling.
  - Added endpoint and service/cache tests covering:
    - valid supported ZIP
    - unsupported NJ ZIP
    - non-NJ ZIP
    - invalid ZIP format
    - suggestions endpoint behaviors
  - Added caching behavior documentation and updated root docs/env scaffolding for M4.
  - Ran live local API smoke checks against `next dev` + local Postgres and verified expected status branches plus `304` ETag behavior.
- In progress:
  - None.
- Blockers/risks:
  - Staging load-test validation for p95 API latency (<250ms) is still pending; local unit/route tests pass.
  - Redis cache behavior in production mode requires valid `REDIS_URL`/`REDIS_TOKEN` runtime secrets.
- Decisions made:
  - Implemented M4 as a single PR-sized diff because route surface, caching layer, and tests fit coherently in one reviewable change set.
  - Used versioned cache keys (`CACHE_DATA_VERSION`) for non-destructive invalidation instead of key-pattern deletes.
- Files changed:
  - `.env.example`
  - `README.md`
  - `apps/web/package.json`
  - `package-lock.json`
  - `apps/web/app/api/v1/dashboard/[zip]/route.ts`
  - `apps/web/app/api/v1/dashboard/[zip]/route.test.ts`
  - `apps/web/app/api/v1/zips/[zip]/suggestions/route.ts`
  - `apps/web/app/api/v1/zips/[zip]/suggestions/route.test.ts`
  - `apps/web/lib/api/dashboard-route.ts`
  - `apps/web/lib/api/zip-suggestions-route.ts`
  - `apps/web/lib/api/contracts.ts`
  - `apps/web/lib/api/dashboard-service.ts`
  - `apps/web/lib/api/dashboard-service.test.ts`
  - `apps/web/lib/api/cache.ts`
  - `apps/web/lib/api/cache.test.ts`
  - `apps/web/lib/api/http.ts`
  - `apps/web/docs/m4-caching.md`
  - `MILESTONES.md`
- Commands run for verification:
  - `npm install`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test`
  - `npm run db:up`
  - `docker compose exec -T db psql -U zipmarket -d zipmarket -c "SELECT (SELECT COUNT(*) FROM dim_zip) AS dim_zip_count, (SELECT COUNT(*) FROM mart_zip_dashboard_latest) AS latest_count; SELECT BTRIM(zip_code) AS supported_zip FROM dim_zip WHERE is_nj AND is_supported ORDER BY zip_code LIMIT 1; SELECT BTRIM(zip_code) AS unsupported_zip FROM dim_zip WHERE is_nj AND NOT is_supported ORDER BY zip_code LIMIT 1; SELECT BTRIM(zip_code) AS non_nj_zip FROM dim_zip WHERE NOT is_nj ORDER BY zip_code LIMIT 1;"`
  - `npm run dev -w @zipmarket/web`
  - `node -e "...fetch /api/v1/dashboard/{supported|unsupported|non_nj|invalid} and /api/v1/zips/{zip}/suggestions smoke checks..."`
  - `node -e "...fetch dashboard endpoint twice with If-None-Match to verify 304..."`
- Next exact step:
  - Start M5 (frontend shell and ZIP search flows) on a new PR branch using the new M4 endpoints as the data contract.

### Handoff - 2026-02-11 21:38 (local)

- Active milestone: M6
- Branch: main
- Last commit: 58c9cc3
- Completed since last handoff:
  - Implemented M6 dashboard UI in `apps/web/components/zip-dashboard-shell.tsx`:
    - KPI strip with latest values and MoM/YoY deltas.
    - Segment controls (`all`, `single_family`, `condo_coop`, `townhouse`) wired to dashboard API query params.
    - Five trend charts (list vs sale price, sale-to-list, sold-over-list, new listings, sales volume) with light/dark readable palettes.
    - Competitiveness card showing label, score, explanation, and confidence tier.
  - Added metric presentation and tooltip-copy utilities in `apps/web/lib/dashboard/dashboard-presenter.ts`.
  - Added M6 unit tests in `apps/web/lib/dashboard/dashboard-presenter.test.ts` and expanded dashboard-client tests for segment query handling.
  - Updated `apps/web/components/dashboard-disclaimer.tsx` to replace placeholder tooltip chips with finalized metric/methodology copy.
  - Added chart color tokens in `apps/web/app/globals.css` for theme parity.
  - Updated `README.md` milestone coverage and advanced status tracking in `MILESTONES.md` (M5 done, M6 ready for review).
- In progress:
  - None.
- Blockers/risks:
  - Dashboard route JS payload increased after adding charts (`/zip/[zip]` first-load JS reported as ~230 kB in local build); monitor during M8 performance validation.
- Decisions made:
  - Implemented M6 as a single PR-sized diff because M4 API contracts and M5 shell were already in place and allowed cohesive review.
  - Kept dashboard tooltip copy spec-aligned and visible via metric-level info chips plus methodology disclaimer chips.
- Files changed:
  - `apps/web/components/zip-dashboard-shell.tsx`
  - `apps/web/components/dashboard-disclaimer.tsx`
  - `apps/web/lib/dashboard/dashboard-presenter.ts`
  - `apps/web/lib/dashboard/dashboard-presenter.test.ts`
  - `apps/web/lib/dashboard/dashboard-client.ts`
  - `apps/web/lib/dashboard/dashboard-client.test.ts`
  - `apps/web/app/globals.css`
  - `apps/web/package.json`
  - `package-lock.json`
  - `README.md`
  - `MILESTONES.md`
- Commands run for verification:
  - `npm install recharts@^2.15.0 -w @zipmarket/web`
  - `npm run test -w @zipmarket/web`
  - `npm run lint -w @zipmarket/web`
  - `npm run typecheck -w @zipmarket/web`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test`
  - `npm run build -w @zipmarket/web`
- Next exact step:
  - Review and commit this M6 PR-sized diff, then begin M7 reliability/observability/security hardening.
