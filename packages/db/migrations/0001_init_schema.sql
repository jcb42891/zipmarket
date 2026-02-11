CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS ingestion_run (
  run_id UUID PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  rows_read INTEGER NOT NULL DEFAULT 0,
  rows_written INTEGER NOT NULL DEFAULT 0,
  rows_rejected INTEGER NOT NULL DEFAULT 0,
  error_summary TEXT NULL,
  source_checksum_sha256 TEXT NULL
);

CREATE TABLE IF NOT EXISTS dim_zip (
  zip_code CHAR(5) PRIMARY KEY,
  state_code CHAR(2) NOT NULL,
  city TEXT NULL,
  county TEXT NULL,
  latitude DOUBLE PRECISION NULL,
  longitude DOUBLE PRECISION NULL,
  geog GEOGRAPHY(POINT, 4326) NULL,
  is_nj BOOLEAN NOT NULL,
  is_supported BOOLEAN NOT NULL DEFAULT FALSE,
  support_reason TEXT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT dim_zip_zip_code_digits CHECK (zip_code ~ '^[0-9]{5}$')
);

CREATE TABLE IF NOT EXISTS dim_property_type (
  property_type_key TEXT PRIMARY KEY,
  source_property_type TEXT NOT NULL,
  is_mvp_exposed BOOLEAN NOT NULL
);

CREATE TABLE IF NOT EXISTS fact_zip_market_monthly (
  zip_code CHAR(5) NOT NULL REFERENCES dim_zip(zip_code),
  period_begin DATE NOT NULL,
  period_end DATE NOT NULL,
  property_type_key TEXT NOT NULL REFERENCES dim_property_type(property_type_key),
  median_sale_price NUMERIC NULL,
  median_list_price NUMERIC NULL,
  homes_sold INTEGER NULL,
  new_listings INTEGER NULL,
  avg_sale_to_list NUMERIC NULL,
  sold_above_list NUMERIC NULL,
  median_sale_price_mom NUMERIC NULL,
  median_sale_price_yoy NUMERIC NULL,
  median_list_price_mom NUMERIC NULL,
  median_list_price_yoy NUMERIC NULL,
  homes_sold_yoy NUMERIC NULL,
  new_listings_yoy NUMERIC NULL,
  avg_sale_to_list_yoy NUMERIC NULL,
  sold_above_list_yoy NUMERIC NULL,
  source_last_updated TIMESTAMPTZ NULL,
  ingestion_run_id UUID NOT NULL REFERENCES ingestion_run(run_id),
  PRIMARY KEY (zip_code, period_end, property_type_key),
  CONSTRAINT fact_zip_market_monthly_period_bounds CHECK (period_end >= period_begin)
);

CREATE TABLE IF NOT EXISTS mart_zip_dashboard_latest (
  zip_code CHAR(5) NOT NULL REFERENCES dim_zip(zip_code),
  property_type_key TEXT NOT NULL REFERENCES dim_property_type(property_type_key),
  period_end DATE NOT NULL,
  median_sale_price NUMERIC NULL,
  median_list_price NUMERIC NULL,
  homes_sold INTEGER NULL,
  new_listings INTEGER NULL,
  avg_sale_to_list NUMERIC NULL,
  sold_above_list NUMERIC NULL,
  median_sale_price_yoy NUMERIC NULL,
  median_list_price_yoy NUMERIC NULL,
  homes_sold_yoy NUMERIC NULL,
  new_listings_yoy NUMERIC NULL,
  avg_sale_to_list_yoy NUMERIC NULL,
  sold_above_list_yoy NUMERIC NULL,
  sale_to_list_pct_over_under NUMERIC NULL,
  competitiveness_score INTEGER NULL,
  competitiveness_label TEXT NULL,
  competitiveness_explanation TEXT NULL,
  confidence_tier TEXT NULL,
  source_last_updated TIMESTAMPTZ NULL,
  refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (zip_code, property_type_key)
);

CREATE INDEX IF NOT EXISTS idx_fact_zip_market_monthly_zip_property_period_end_desc
  ON fact_zip_market_monthly (zip_code, property_type_key, period_end DESC);

CREATE INDEX IF NOT EXISTS idx_fact_zip_market_monthly_period_end_desc
  ON fact_zip_market_monthly (period_end DESC);

CREATE INDEX IF NOT EXISTS idx_dim_zip_is_supported_is_nj
  ON dim_zip (is_supported, is_nj);

CREATE INDEX IF NOT EXISTS idx_dim_zip_geog_gist
  ON dim_zip USING GIST (geog);
