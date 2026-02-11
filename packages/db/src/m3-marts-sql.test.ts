import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const migrationFilePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "migrations",
  "0003_m3_data_marts_and_support_logic.sql"
);

test("M3 migration declares marts, support logic, and nearest ZIP helpers", async () => {
  const sql = await fs.readFile(migrationFilePath, "utf8");

  assert.match(sql, /CREATE TABLE IF NOT EXISTS mart_zip_dashboard_series/);
  assert.match(sql, /CREATE INDEX IF NOT EXISTS idx_mart_zip_dashboard_series_zip_property_period_end_desc/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION refresh_zipmarket_marts/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION find_nearest_supported_zips/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION zipmarket_competitiveness_score/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION zipmarket_competitiveness_explanation/);
});
