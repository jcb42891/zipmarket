import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const migrationFilePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "migrations",
  "0002_ingestion_metadata.sql"
);

test("M2 ingestion metadata migration declares required tables and indexes", async () => {
  const sql = await fs.readFile(migrationFilePath, "utf8");

  assert.match(sql, /CREATE TABLE IF NOT EXISTS source_snapshot/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS ingestion_reject/);
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS uq_source_snapshot_source_checksum/);
  assert.match(sql, /CREATE INDEX IF NOT EXISTS idx_ingestion_reject_run_id/);
  assert.match(sql, /CREATE INDEX IF NOT EXISTS idx_ingestion_reject_source_name/);
});
