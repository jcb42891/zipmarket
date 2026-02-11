# @zipmarket/db

Database package for ZipMarket migrations and seeds.

## Local database

The repo includes a local Postgres 16 + PostGIS service in `docker-compose.yml`.

```bash
npm run db:up
```

Default local connection URL used by scripts when `DATABASE_URL` is not set:

```txt
postgresql://zipmarket:zipmarket@127.0.0.1:5433/zipmarket
```

Stop local database:

```bash
npm run db:down
```

## Migrations

Migrations are SQL files in `packages/db/migrations`, applied in lexicographic order.

```bash
npm run db:migrate
```

Applied migrations are tracked in `_zipmarket_migrations` with a SHA-256 checksum so changed historical files fail fast.

## Seeds

Seed the property type dimension:

```bash
npm run db:seed
```

Seed behavior is idempotent (`INSERT ... ON CONFLICT ... DO UPDATE`).

## Milestone M1/M2 verify commands

```bash
npm run db:up
npm run db:migrate
npm run db:seed
```

Then run SQL checks for expected tables and indexes:

```bash
docker compose exec -T db psql -U zipmarket -d zipmarket -c "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('dim_zip','dim_property_type','fact_zip_market_monthly','mart_zip_dashboard_latest','ingestion_run','source_snapshot','ingestion_reject') ORDER BY tablename;"
docker compose exec -T db psql -U zipmarket -d zipmarket -c "SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname IN ('idx_fact_zip_market_monthly_zip_property_period_end_desc','idx_fact_zip_market_monthly_period_end_desc','idx_dim_zip_is_supported_is_nj','idx_dim_zip_geog_gist') ORDER BY indexname;"
docker compose exec -T db psql -U zipmarket -d zipmarket -c "SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname IN ('uq_source_snapshot_source_checksum','idx_ingestion_reject_run_id','idx_ingestion_reject_source_name') ORDER BY indexname;"
```
