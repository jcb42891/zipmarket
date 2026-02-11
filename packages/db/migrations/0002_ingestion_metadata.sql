CREATE TABLE IF NOT EXISTS source_snapshot (
  snapshot_id UUID PRIMARY KEY,
  ingestion_run_id UUID NOT NULL REFERENCES ingestion_run(run_id) ON DELETE CASCADE,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_checksum_sha256 TEXT NOT NULL,
  downloaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT source_snapshot_checksum_sha256_hex CHECK (source_checksum_sha256 ~ '^[a-f0-9]{64}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_source_snapshot_source_checksum
  ON source_snapshot (source_name, source_checksum_sha256);

CREATE TABLE IF NOT EXISTS ingestion_reject (
  reject_id BIGSERIAL PRIMARY KEY,
  ingestion_run_id UUID NOT NULL REFERENCES ingestion_run(run_id) ON DELETE CASCADE,
  source_name TEXT NOT NULL,
  line_number INTEGER NULL CHECK (line_number IS NULL OR line_number > 0),
  reject_reason TEXT NOT NULL,
  raw_payload TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ingestion_reject_run_id
  ON ingestion_reject (ingestion_run_id);

CREATE INDEX IF NOT EXISTS idx_ingestion_reject_source_name
  ON ingestion_reject (source_name);
