# ZipMarket MVP Technical Specification

Version: 1.0  
Date: February 7, 2026  
Source of truth: `PRD.md`

## 1. Scope and objective

This spec defines the full technical implementation to deliver ZipMarket MVP for New Jersey ZIP-code housing market intelligence, with:

- ZIP search and dashboard load
- historical pricing and competitiveness KPIs
- clear "not live inventory" trust/disclaimer UX
- unsupported ZIP handling with nearby ZIP suggestions
- precomputed market metrics for fast response times

This spec is designed to be implementation-ready.

## 2. MVP scope (what ships)

### Included in MVP

- NJ-only ZIP search with 5-digit validation
- Dashboard metrics at ZIP level:
- Median list price trend
- Median sale price trend
- Sale-to-list ratio
- Percent sold over list
- New listings per month
- Sales volume per month
- Competitiveness indicator (heuristic)
- "All homes" default view
- Sold-only optional segmentation by property type where supported by source data:
- Single-family
- Condo/co-op
- Townhouse
- Required disclaimers and metric tooltips

### Explicit MVP constraints

- Not a listings search engine
- No real-time active inventory counts
- No property-level bid recommendations
- No bedroom-level segmentation in MVP (data source limitation)
- No true price-band segmentation in MVP (data source limitation)

## 3. Product-to-engineering requirement mapping

1. ZIP input is accepted only as `^\d{5}$`.
2. ZIP must resolve to NJ or return NJ-only error state.
3. Unsupported NJ ZIP returns "Data not available yet" with nearest supported ZIPs.
4. Dashboard API returns all KPI blocks in one response (single roundtrip).
5. Trend window defaults to 36 months; fallback to available history if less.
6. Persistent disclaimer appears on every ZIP dashboard.
7. Data is precomputed and query path avoids runtime heavy aggregation.

## 4. Technology stack

### Application stack

- Runtime: Node.js 22 LTS
- Language: TypeScript 5.x
- Web framework: Next.js 15 (App Router)
- UI: React 19 + Tailwind CSS 4
- Charting: Recharts
- Validation: Zod

### Backend/API stack

- API surface: Next.js Route Handlers (`/api/v1/...`)
- DB access: Drizzle ORM + parameterized SQL for heavy reads
- Caching: Redis (Upstash) for hot ZIP dashboard payloads

### Data stack

- Primary DB: PostgreSQL 16
- Geospatial: PostGIS extension for nearest-ZIP suggestions
- ETL: TypeScript CLI scripts (streaming parse, idempotent upsert)
- Scheduling: GitHub Actions cron + manual dispatch

### Infrastructure

- Web/API hosting: Vercel
- Database: Supabase Postgres (or managed Postgres equivalent)
- Object storage for raw snapshots: S3-compatible bucket
- Observability: Sentry (app errors) + structured logs (Pino) + uptime checks

## 5. External data sources and licensing

## 5.1 Primary market metrics source

Redfin Data Center ZIP-level market tracker feed (TSV GZIP):

- URL pattern (monthly):  
  `https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_market_tracker/zip_code_market_tracker.tsv000.gz`
- Useful fields:
- `MEDIAN_SALE_PRICE`
- `MEDIAN_LIST_PRICE`
- `HOMES_SOLD`
- `NEW_LISTINGS`
- `AVG_SALE_TO_LIST`
- `SOLD_ABOVE_LIST`
- `PERIOD_BEGIN`, `PERIOD_END`, `LAST_UPDATED`
- `PROPERTY_TYPE`, `STATE_CODE`, `REGION`

Research validation completed February 7, 2026:

- Feed includes required KPI fields for MVP.
- NJ ZIP coverage in feed: 617 distinct ZIPs.
- Period coverage for NJ ZIP rows: March 2012 through December 2025.
- Feed includes property types but does not include bedroom-level segmentation.

Attribution requirement for production UI/legal:

- Display source attribution for Redfin-based metrics in footer/tooltip.
- Legal review required before launch for final commercial usage language.

## 5.2 ZIP metadata and geospatial source

GeoNames US postal code dataset:

- URL: `https://download.geonames.org/export/zip/US.zip`
- File: `US.txt`
- Fields used:
- postal code
- state code
- county
- latitude
- longitude
- License: CC BY 4.0 (attribution required)

Usage in MVP:

- NJ ZIP validation support table
- centroids for nearest supported ZIP suggestions

## 5.3 Dataset limitations that affect scope

- Redfin ZIP feed does not include bedroom dimension or transaction-level price distributions.
- Therefore:
- Bedroom filter (2 bed, 3 bed, 4+) is out of MVP.
- ZIP-specific price-band segmentation is out of MVP.

If bedroom and price-band segmentation becomes mandatory, a paid property-level sold/listing source (MLS-reso feed or equivalent vendor) must be added in a later phase.

## 6. System architecture

## 6.1 High-level flow

1. Scheduled ETL downloads source files.
2. ETL validates, normalizes, and upserts into Postgres fact tables.
3. Materialized dashboard views are refreshed.
4. API route fetches precomputed latest + timeseries for one ZIP and segment.
5. Response is cached in Redis and served to Next.js dashboard.

## 6.2 Runtime boundaries

- ETL and API are separate runtime concerns:
- ETL runs on cron and writes data.
- API is read-only against marts/facts.
- No runtime aggregation across raw datasets on request path.

## 6.3 Proposed repository layout

```
zipmarket/
  apps/
    web/                         # Next.js app (UI + API routes)
    etl/                         # Ingestion scripts and job runners
  packages/
    db/                          # Drizzle schema, migrations, SQL helpers
    shared/                      # zod schemas, API types, constants
  infra/
    github-actions/              # workflow yaml templates
  data/
    fixtures/                    # test TSV fixtures
  PRD.md
  SPEC.md
```

## 7. Data model

## 7.1 Core tables

`dim_zip`

- `zip_code CHAR(5) PRIMARY KEY`
- `state_code CHAR(2) NOT NULL`
- `city TEXT NULL`
- `county TEXT NULL`
- `latitude DOUBLE PRECISION NULL`
- `longitude DOUBLE PRECISION NULL`
- `geog GEOGRAPHY(POINT,4326) NULL`
- `is_nj BOOLEAN NOT NULL`
- `is_supported BOOLEAN NOT NULL DEFAULT FALSE`
- `support_reason TEXT NULL`
- `updated_at TIMESTAMPTZ NOT NULL`

`dim_property_type`

- `property_type_key TEXT PRIMARY KEY` (`all`, `single_family`, `condo_coop`, `townhouse`, `multi_family`)
- `source_property_type TEXT NOT NULL`
- `is_mvp_exposed BOOLEAN NOT NULL`

`fact_zip_market_monthly`

- `zip_code CHAR(5) NOT NULL`
- `period_begin DATE NOT NULL`
- `period_end DATE NOT NULL`
- `property_type_key TEXT NOT NULL`
- `median_sale_price NUMERIC NULL`
- `median_list_price NUMERIC NULL`
- `homes_sold INTEGER NULL`
- `new_listings INTEGER NULL`
- `avg_sale_to_list NUMERIC NULL`
- `sold_above_list NUMERIC NULL`
- `median_sale_price_mom NUMERIC NULL`
- `median_sale_price_yoy NUMERIC NULL`
- `median_list_price_mom NUMERIC NULL`
- `median_list_price_yoy NUMERIC NULL`
- `homes_sold_yoy NUMERIC NULL`
- `new_listings_yoy NUMERIC NULL`
- `avg_sale_to_list_yoy NUMERIC NULL`
- `sold_above_list_yoy NUMERIC NULL`
- `source_last_updated TIMESTAMPTZ NULL`
- `ingestion_run_id UUID NOT NULL`
- Primary key: `(zip_code, period_end, property_type_key)`

`mart_zip_dashboard_latest`

- One row per `(zip_code, property_type_key)` for latest period
- Includes derived:
- `sale_to_list_pct_over_under`
- competitiveness score/label/explanation
- confidence tier

`ingestion_run`

- `run_id UUID PRIMARY KEY`
- `started_at`, `finished_at`
- `status` (`running`, `succeeded`, `failed`)
- `source_name`
- `source_url`
- `rows_read`, `rows_written`, `rows_rejected`
- `error_summary`

## 7.2 Indexes

- `fact_zip_market_monthly(zip_code, property_type_key, period_end DESC)`
- `fact_zip_market_monthly(period_end DESC)`
- `dim_zip(is_supported, is_nj)`
- `dim_zip USING GIST (geog)`

## 8. Data ingestion implementation

## 8.1 Job schedule

- `redfin-monthly-refresh`: daily at 06:30 UTC (idempotent; no-op if unchanged)
- `geonames-refresh`: monthly on day 1 at 07:00 UTC
- `rebuild-marts`: triggered after successful source ingest

## 8.2 ETL steps

1. Acquire advisory lock in Postgres (`pg_try_advisory_lock`) to prevent concurrent runs.
2. Download source file to temp storage and compute checksum.
3. Record `ingestion_run` row with `running` status.
4. Stream-parse TSV, normalize fields, and stage valid rows.
5. Apply DQ checks and write rejects to reject log.
6. Upsert into `fact_zip_market_monthly`.
7. Recompute `is_supported` flags in `dim_zip`.
8. Refresh materialized marts (`CONCURRENTLY`).
9. Invalidate Redis keys by version bump.
10. Mark run success/failure and emit alert on failure.

## 8.3 Source normalization rules

- Keep only:
- `REGION_TYPE = "zip code"`
- `STATE_CODE = "NJ"` for market facts
- `IS_SEASONALLY_ADJUSTED = false`
- Parse ZIP from `REGION` using `Zip Code: #####`.
- Cross-check parsed ZIP against `dim_zip` state metadata:
- if source says `STATE_CODE='NJ'` but ZIP metadata says non-NJ, reject row and log anomaly
- Map `PROPERTY_TYPE` values:
- `All Residential` -> `all`
- `Single Family Residential` -> `single_family`
- `Condo/Co-op` -> `condo_coop`
- `Townhouse` -> `townhouse`
- `Multi-Family (2-4 Unit)` -> `multi_family`
- Convert `NA` strings to SQL `NULL`.

## 8.4 Data quality gates

Hard-fail run if:

- Header schema mismatch for required columns
- Parse error rate > 0.5%
- Latest source date regresses vs previous successful run

Soft warnings:

- Latest NJ row count drops > 15% week-over-week
- Non-null coverage for any core metric < 95% in latest period
- New unknown property type value appears

## 8.5 Supported ZIP logic

`dim_zip.is_supported = true` if all conditions hold:

1. ZIP is NJ (`state_code = 'NJ'`)
2. ZIP exists in latest Redfin period for `property_type_key = 'all'`
3. At least 24 monthly rows in trailing 36 months
4. Latest row has non-null: `median_sale_price`, `homes_sold`, `avg_sale_to_list`, `sold_above_list`

Else unsupported with `support_reason` set (`no_recent_data`, `insufficient_history`, `missing_core_metrics`, etc).

## 9. Metric definitions (MVP)

All metrics come from `property_type_key = 'all'` unless user applies a segment filter.

1. Median List Price (trend)
- Source field: `median_list_price`
- Trend: trailing 24-36 points by `period_end`
- Headline: latest non-null value
- Deltas: `median_list_price_mom`, `median_list_price_yoy` (fallback recompute if null)

2. Median Sale Price (trend)
- Source field: `median_sale_price`
- Headline + YoY
- Optional chart overlay with median list price

3. Sale-to-List Ratio
- Source field: `avg_sale_to_list`
- Display ratio to 3 decimals (e.g., `1.021`)
- Display over/under list percentage: `(avg_sale_to_list - 1) * 100`

4. Percent Sold Over List
- Source field: `sold_above_list` (fraction)
- Display as percent (`* 100`, one decimal)

5. New Listings per Month
- Source field: `new_listings`

6. Sales Volume
- Source field: `homes_sold`

Important note: Redfin monthly rows represent rolling windows rather than strict calendar-month close totals. UI tooltip must clarify this methodology.

## 10. Competitiveness indicator

## 10.1 Inputs

- Latest `avg_sale_to_list`
- Latest `sold_above_list`
- Latest `new_listings_yoy`
- Latest `homes_sold_yoy`

## 10.2 Scoring

- Sale-to-list score:
- `>= 1.05` -> +3
- `1.02 - 1.049` -> +2
- `1.00 - 1.019` -> +1
- `0.98 - 0.999` -> 0
- `< 0.98` -> -1

- Sold-over-list score:
- `>= 0.60` -> +3
- `0.45 - 0.599` -> +2
- `0.30 - 0.449` -> +1
- `0.15 - 0.299` -> 0
- `< 0.15` -> -1

- New listings YoY score (inventory pressure):
- `<= -0.15` -> +2
- `-0.149 - -0.05` -> +1
- `-0.049 - 0.049` -> 0
- `0.05 - 0.149` -> -1
- `>= 0.15` -> -2

- Sales volume YoY score (demand context):
- `>= 0.10` -> +1
- `<= -0.10` -> -1
- otherwise -> 0

Total score -> label:

- `<= 0`: Buyer-leaning
- `1 to 3`: Balanced
- `4 to 6`: Competitive
- `>= 7`: Very competitive

## 10.3 Explanation text generation

Template fragments are selected from top drivers:

- "Most homes are selling over list."
- "Prices are landing at/above asking."
- "New listings are down from last year."
- "Sales activity is rising/falling year over year."

Use 1-2 short sentences, max 180 chars.

## 11. API specification

## 11.1 `GET /api/v1/dashboard/{zip}`

Query params:

- `segment` (default `all`) values: `all|single_family|condo_coop|townhouse`
- `months` (default `36`, min `12`, max `36`)

Response 200 (supported):

- `zip`
- `status: "supported"`
- `segment`
- `latest_period_end`
- `kpis` object
- `series` object (arrays aligned by period)
- `competitiveness` object
- `disclaimer` string
- `methodology` object (`source`, `last_updated`, `window_type`)

Response 200 (unsupported NJ ZIP):

- `zip`
- `status: "unsupported"`
- `message: "Data not available yet"`
- `nearby_supported_zips` (up to 5 with distance miles)

Response 400:

- invalid ZIP format
- non-NJ ZIP

Response 404:

- ZIP not found in metadata dataset

## 11.2 `GET /api/v1/zips/{zip}/suggestions`

Returns nearest supported ZIPs only (used by unsupported state and typeahead fallback).

## 11.3 Caching headers

- `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`
- `ETag` based on `zip + segment + latest_period_end + data_version`

## 12. ZIP validation and nearby suggestions

Validation flow:

1. Check regex `^\d{5}$`.
2. Lookup `dim_zip`.
3. If state not NJ -> return NJ-only state.
4. If NJ and supported -> load dashboard.
5. If NJ and unsupported -> return suggestions.

Suggestions query:

- If centroid exists for input ZIP:
- nearest supported ZIPs by PostGIS distance
- If centroid missing:
- fallback by absolute numeric ZIP distance among supported NJ ZIPs

## 13. Frontend implementation details

## 13.1 Routes

- `/` -> search landing page
- `/zip/[zip]` -> dashboard page

## 13.2 Dashboard composition

- Search bar (persistent at top)
- KPI strip (latest values + deltas)
- Trend charts:
- list vs sale price line chart
- sale-to-list ratio line chart
- percent sold over list line chart
- new listings bar/line chart
- sales volume bar chart
- competitiveness card
- disclaimer block (persistent)

## 13.3 UX states

- Loading skeleton
- Supported data
- Unsupported NJ ZIP + suggestions
- Non-NJ ZIP message
- Invalid ZIP input
- Partial data (metric-level no-data cards)

## 13.4 Required copy

Persistent disclaimer:

"This dashboard is based on closed sales and aggregated market data. It is not a live listings feed and does not reflect currently active homes."

Tooltip examples:

- Sale-to-list: historical closed-sales ratio
- New listings: historical listing activity, not current inventory

## 14. Performance and reliability targets

- Supported ZIP dashboard API p95: < 250 ms (server-side)
- End-to-end dashboard load p95: < 500 ms on warm cache
- Availability target: 99.5%
- ETL success rate: >= 99% monthly runs

Performance strategy:

- Precomputed marts
- selective indexes
- Redis cache for hot ZIP responses
- gzip/brotli response compression
- payload size target: <= 80 KB JSON per dashboard response

## 15. Security, privacy, and compliance

Required environment variables:

- `DATABASE_URL`
- `REDIS_URL`
- `REDIS_TOKEN`
- `REDFIN_ZIP_FEED_URL`
- `GEONAMES_US_ZIP_URL`
- `RAW_DATA_BUCKET_URL`
- `RAW_DATA_BUCKET_KEY`
- `RAW_DATA_BUCKET_SECRET`
- `SENTRY_DSN`
- `APP_BASE_URL`

- No user PII required for MVP
- Input validation via Zod and server-side sanitization
- Parameterized SQL only
- Rate limit public API endpoints
- Secrets in host-managed secret store
- Audit dependencies weekly for known vulnerabilities

Compliance/legal:

- Include source attribution (Redfin + GeoNames)
- Complete legal review of source terms before production launch

## 16. Observability and runbooks

- Structured logs:
- request id, ZIP, segment, status, latency
- ETL logs:
- rows read/written/rejected, source checksum, run id
- Metrics:
- API latency p50/p95
- cache hit ratio
- ETL duration/failure count
- Alerts:
- ETL failure
- data freshness breach (> 35 days stale)
- 5xx error spike

Runbook essentials:

- Re-run last failed ingestion
- Roll back to previous data version
- Disable unhealthy segment via feature flag

## 17. Testing strategy

Unit tests:

- metric formatting and delta computations
- competitiveness scoring and label boundaries
- ZIP validation and suggestion sorting

Integration tests:

- ETL parse/upsert using fixture TSV
- API response schema and error states

E2E tests (Playwright):

- happy path for supported NJ ZIP
- unsupported NJ ZIP with suggestions
- non-NJ ZIP rejection
- disclaimer visibility on dashboard

Data tests:

- latest period completeness checks
- monotonic time-series ordering
- no duplicate PK in fact table

## 18. Delivery plan to MVP

Week 1:

- repo scaffolding, DB schema, migrations, seed property types, ZIP metadata ingest

Week 2:

- Redfin ETL pipeline, DQ checks, marts, caching layer

Week 3:

- Dashboard API routes, ZIP validation, suggestion endpoint

Week 4:

- Frontend dashboard, charts, disclaimers, unsupported states

Week 5:

- competitiveness indicator, performance tuning, observability, QA hardening

Week 6:

- staging UAT, legal/source attribution checks, production launch

## 19. Risks and mitigations

1. Source schema drift
- Mitigation: strict header validation + ingestion alarms + quick patch workflow.

2. Data licensing/attribution ambiguity
- Mitigation: legal review before launch + explicit attribution components.

3. Sparse ZIPs causing noisy stats
- Mitigation: support thresholds + confidence tier labels + partial/no-data states.

4. Segmentation expectation mismatch
- Mitigation: clearly mark bedroom/price-band as post-MVP pending property-level source.

## 20. MVP acceptance criteria

1. User can enter any NJ ZIP and get:
- dashboard if supported
- unsupported state + nearby suggestions if not supported

2. Dashboard returns all six core KPI groups and competitiveness indicator.

3. Persistent disclaimer and metric tooltips are present.

4. API p95 latency < 250 ms; page load p95 < 500 ms on warm cache.

5. Data freshness:
- latest source date no older than 35 days from current date.

6. End-to-end tests pass in CI for core states.

## 21. Post-MVP backlog (already identified)

- Bedroom segmentation (`2`, `3`, `4+`) using paid property-level source
- ZIP-derived price-band segmentation with transaction-level distributions
- Weekly nowcast layer for fresher "latest" competitiveness headline
- Active listing inventory if/when licensed feed is added

## 22. Research references used for this spec

- Redfin Data Center (housing market data and downloadable feed links):  
  `https://www.redfin.com/news/data-center/`  
  `https://www.redfin.com/news/data-center/printouts/housing-market-data/`
- Redfin Data definitions (metric glossary):  
  `https://www.redfin.com/news/data-center/data-definitions/`
- GeoNames postal code dataset and readme:  
  `https://download.geonames.org/export/zip/`  
  `https://download.geonames.org/export/zip/readme.txt`
