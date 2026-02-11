import type { SqlExecutor } from "./migrate.js";

export interface RefreshMartsSummary {
  updatedZipRows: number;
  latestRows: number;
  seriesRows: number;
}

interface RefreshMartsRow {
  updated_zip_rows: number | string;
  latest_rows: number | string;
  series_rows: number | string;
}

export interface SupportedZipSuggestion {
  zipCode: string;
  distanceMiles: number;
}

interface SupportedZipSuggestionRow {
  zip_code: string;
  distance_miles: number | string;
}

const REFRESH_MARTS_SQL = `
SELECT updated_zip_rows, latest_rows, series_rows
FROM refresh_zipmarket_marts()
`;

const FIND_NEAREST_SUPPORTED_ZIPS_SQL = `
SELECT zip_code, distance_miles
FROM find_nearest_supported_zips($1::char(5), $2)
`;

function parseNonNegativeInteger(value: unknown, fieldName: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Expected ${fieldName} to be a non-negative integer, received ${value}.`);
  }
  return parsed;
}

function parseDistanceMiles(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Expected distance_miles to be a non-negative number, received ${value}.`);
  }
  return parsed;
}

function normalizeZipCode(zipCode: string): string {
  const normalized = zipCode.trim();
  if (!/^\d{5}$/.test(normalized)) {
    throw new Error(`Expected zipCode to be a 5-digit ZIP value, received "${zipCode}".`);
  }
  return normalized;
}

function normalizeMaxResults(maxResults: number): number {
  if (!Number.isInteger(maxResults) || maxResults <= 0 || maxResults > 50) {
    throw new Error(`Expected maxResults to be an integer between 1 and 50, received ${maxResults}.`);
  }
  return maxResults;
}

export async function refreshMarts(executor: SqlExecutor): Promise<RefreshMartsSummary> {
  const result = await executor.query<RefreshMartsRow>(REFRESH_MARTS_SQL);
  const row = result.rows[0];

  if (!row) {
    throw new Error("Expected refresh_zipmarket_marts() to return one summary row.");
  }

  return {
    updatedZipRows: parseNonNegativeInteger(row.updated_zip_rows, "updated_zip_rows"),
    latestRows: parseNonNegativeInteger(row.latest_rows, "latest_rows"),
    seriesRows: parseNonNegativeInteger(row.series_rows, "series_rows")
  };
}

export async function findNearestSupportedZips(
  executor: SqlExecutor,
  zipCode: string,
  maxResults: number = 5
): Promise<SupportedZipSuggestion[]> {
  const normalizedZipCode = normalizeZipCode(zipCode);
  const normalizedMaxResults = normalizeMaxResults(maxResults);

  const result = await executor.query<SupportedZipSuggestionRow>(FIND_NEAREST_SUPPORTED_ZIPS_SQL, [
    normalizedZipCode,
    normalizedMaxResults
  ]);

  return result.rows.map((row) => ({
    zipCode: row.zip_code.trim(),
    distanceMiles: parseDistanceMiles(row.distance_miles)
  }));
}
