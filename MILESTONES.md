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
| M1 | Database foundation and schema | TBD | Not Started |  |  |  |
| M2 | ETL scaffolding and source ingestion | TBD | Not Started |  |  |  |
| M3 | Data marts, derived metrics, and support logic | TBD | Not Started |  |  |  |
| M4 | API layer and caching | TBD | Not Started |  |  |  |
| M5 | Frontend shell and ZIP search flows | TBD | Not Started |  |  |  |
| M6 | Dashboard charts, segmentation, and indicator UX | TBD | Not Started |  |  |  |
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
