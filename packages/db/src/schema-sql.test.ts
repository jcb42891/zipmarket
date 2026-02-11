import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const migrationFilePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "migrations",
  "0001_init_schema.sql"
);

test("base migration declares required tables and indexes for M1", async () => {
  const sql = await fs.readFile(migrationFilePath, "utf8");

  assert.match(sql, /CREATE EXTENSION IF NOT EXISTS postgis;/);

  const tables = [
    "ingestion_run",
    "dim_zip",
    "dim_property_type",
    "fact_zip_market_monthly",
    "mart_zip_dashboard_latest"
  ];

  for (const tableName of tables) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${tableName}`));
  }

  const indexes = [
    "idx_fact_zip_market_monthly_zip_property_period_end_desc",
    "idx_fact_zip_market_monthly_period_end_desc",
    "idx_dim_zip_is_supported_is_nj",
    "idx_dim_zip_geog_gist"
  ];

  for (const indexName of indexes) {
    assert.match(sql, new RegExp(`CREATE INDEX IF NOT EXISTS ${indexName}`));
  }
});
