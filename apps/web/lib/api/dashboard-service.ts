import { Client } from "pg";
import { NJ_STATE_CODE } from "@zipmarket/shared";

import {
  DASHBOARD_DISCLAIMER,
  DASHBOARD_SOURCE,
  DASHBOARD_UNSUPPORTED_MESSAGE,
  DASHBOARD_WINDOW_TYPE,
  MAX_SUGGESTIONS,
  type DashboardLookupInput,
  type DashboardSupportedResponse,
  type DashboardUnsupportedResponse,
  type ZipSuggestion,
  type ZipSuggestionsResponse
} from "./contracts";

interface ZipContextRow {
  zip_code: string;
  state_code: string;
  is_nj: boolean;
  is_supported: boolean;
}

interface LatestDashboardRow {
  period_end: Date | string;
  median_sale_price: number | string | null;
  median_list_price: number | string | null;
  homes_sold: number | string | null;
  new_listings: number | string | null;
  avg_sale_to_list: number | string | null;
  sold_above_list: number | string | null;
  median_sale_price_yoy: number | string | null;
  median_list_price_yoy: number | string | null;
  homes_sold_yoy: number | string | null;
  new_listings_yoy: number | string | null;
  avg_sale_to_list_yoy: number | string | null;
  sold_above_list_yoy: number | string | null;
  sale_to_list_pct_over_under: number | string | null;
  competitiveness_score: number | string | null;
  competitiveness_label: string | null;
  competitiveness_explanation: string | null;
  confidence_tier: string | null;
  source_last_updated: Date | string | null;
}

interface DashboardSeriesRow {
  period_end: Date | string;
  median_sale_price: number | string | null;
  median_list_price: number | string | null;
  homes_sold: number | string | null;
  new_listings: number | string | null;
  avg_sale_to_list: number | string | null;
  sold_above_list: number | string | null;
  median_sale_price_mom: number | string | null;
  median_list_price_mom: number | string | null;
}

interface NearestSupportedZipRow {
  zip_code: string;
  distance_miles: number | string;
}

interface ParsedLatestDashboardRow {
  periodEnd: string;
  medianSalePrice: number | null;
  medianListPrice: number | null;
  homesSold: number | null;
  newListings: number | null;
  avgSaleToList: number | null;
  soldAboveList: number | null;
  medianSalePriceYoy: number | null;
  medianListPriceYoy: number | null;
  homesSoldYoy: number | null;
  newListingsYoy: number | null;
  avgSaleToListYoy: number | null;
  soldAboveListYoy: number | null;
  saleToListPctOverUnder: number | null;
  competitivenessScore: number | null;
  competitivenessLabel: string | null;
  competitivenessExplanation: string | null;
  confidenceTier: string | null;
  sourceLastUpdated: string | null;
}

interface ParsedDashboardSeriesRow {
  periodEnd: string;
  medianSalePrice: number | null;
  medianListPrice: number | null;
  homesSold: number | null;
  newListings: number | null;
  avgSaleToList: number | null;
  soldAboveList: number | null;
  medianSalePriceMom: number | null;
  medianListPriceMom: number | null;
}

interface ZipContext {
  zipCode: string;
  stateCode: string;
  isNj: boolean;
  isSupported: boolean;
}

export interface QueryResult<Row = unknown> {
  rows: Row[];
  rowCount: number | null;
}

export interface SqlExecutor {
  query<Row = unknown>(text: string, params?: readonly unknown[]): Promise<QueryResult<Row>>;
}

interface NearestSupportedZipSuggestion {
  zipCode: string;
  distanceMiles: number;
}

export type DashboardFetchResult =
  | { type: "supported"; payload: DashboardSupportedResponse }
  | { type: "unsupported"; payload: DashboardUnsupportedResponse }
  | { type: "non_nj" }
  | { type: "zip_not_found" };

export type ZipSuggestionsFetchResult =
  | { type: "ok"; payload: ZipSuggestionsResponse }
  | { type: "non_nj" }
  | { type: "zip_not_found" };

export const DEFAULT_LOCAL_DATABASE_URL =
  "postgresql://zipmarket:zipmarket@127.0.0.1:5433/zipmarket";

const ZIP_CONTEXT_SQL = `
SELECT
  BTRIM(zip_code) AS zip_code,
  BTRIM(state_code) AS state_code,
  is_nj,
  is_supported
FROM dim_zip
WHERE BTRIM(zip_code) = $1
LIMIT 1
`;

const DASHBOARD_LATEST_SQL = `
SELECT
  period_end,
  median_sale_price,
  median_list_price,
  homes_sold,
  new_listings,
  avg_sale_to_list,
  sold_above_list,
  median_sale_price_yoy,
  median_list_price_yoy,
  homes_sold_yoy,
  new_listings_yoy,
  avg_sale_to_list_yoy,
  sold_above_list_yoy,
  sale_to_list_pct_over_under,
  competitiveness_score,
  competitiveness_label,
  competitiveness_explanation,
  confidence_tier,
  source_last_updated
FROM mart_zip_dashboard_latest
WHERE BTRIM(zip_code) = $1
  AND property_type_key = $2
LIMIT 1
`;

const DASHBOARD_SERIES_SQL = `
SELECT
  period_end,
  median_sale_price,
  median_list_price,
  homes_sold,
  new_listings,
  avg_sale_to_list,
  sold_above_list,
  median_sale_price_mom,
  median_list_price_mom
FROM mart_zip_dashboard_series
WHERE BTRIM(zip_code) = $1
  AND property_type_key = $2
ORDER BY period_end DESC
LIMIT $3
`;

const FIND_NEAREST_SUPPORTED_ZIPS_SQL = `
SELECT zip_code, distance_miles
FROM find_nearest_supported_zips($1::char(5), $2)
`;

function resolveDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const configuredValue = env.DATABASE_URL?.trim();
  return configuredValue || DEFAULT_LOCAL_DATABASE_URL;
}

function createPgClient(databaseUrl: string = resolveDatabaseUrl()): Client {
  return new Client({ connectionString: databaseUrl });
}

function parseRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new Error(`Expected ${fieldName} to be a string, received ${String(value)}.`);
  }

  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Expected ${fieldName} to be non-empty.`);
  }

  return normalized;
}

function parseOptionalString(value: unknown, fieldName: string): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return parseRequiredString(value, fieldName);
}

function parseNumberOrNull(value: unknown, fieldName: string): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Expected ${fieldName} to be numeric, received ${String(value)}.`);
  }

  return parsed;
}

function parseIntegerOrNull(value: unknown, fieldName: string): number | null {
  const parsed = parseNumberOrNull(value, fieldName);
  if (parsed === null) {
    return null;
  }

  if (!Number.isInteger(parsed)) {
    throw new Error(`Expected ${fieldName} to be an integer, received ${parsed}.`);
  }

  return parsed;
}

function parseDate(value: unknown, fieldName: string): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error(`Expected ${fieldName} to be a date, received ${value}.`);
    }

    return parsed.toISOString().slice(0, 10);
  }

  throw new Error(`Expected ${fieldName} to be a date value, received ${String(value)}.`);
}

function parseTimestampOrNull(value: unknown, fieldName: string): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error(`Expected ${fieldName} to be a timestamp, received ${value}.`);
    }

    return parsed.toISOString();
  }

  throw new Error(`Expected ${fieldName} to be a timestamp value, received ${String(value)}.`);
}

function parseZipContext(row: ZipContextRow): ZipContext {
  return {
    zipCode: parseRequiredString(row.zip_code, "zip_code"),
    stateCode: parseRequiredString(row.state_code, "state_code"),
    isNj: row.is_nj === true,
    isSupported: row.is_supported === true
  };
}

function parseLatestDashboardRow(row: LatestDashboardRow): ParsedLatestDashboardRow {
  return {
    periodEnd: parseDate(row.period_end, "period_end"),
    medianSalePrice: parseNumberOrNull(row.median_sale_price, "median_sale_price"),
    medianListPrice: parseNumberOrNull(row.median_list_price, "median_list_price"),
    homesSold: parseIntegerOrNull(row.homes_sold, "homes_sold"),
    newListings: parseIntegerOrNull(row.new_listings, "new_listings"),
    avgSaleToList: parseNumberOrNull(row.avg_sale_to_list, "avg_sale_to_list"),
    soldAboveList: parseNumberOrNull(row.sold_above_list, "sold_above_list"),
    medianSalePriceYoy: parseNumberOrNull(row.median_sale_price_yoy, "median_sale_price_yoy"),
    medianListPriceYoy: parseNumberOrNull(row.median_list_price_yoy, "median_list_price_yoy"),
    homesSoldYoy: parseNumberOrNull(row.homes_sold_yoy, "homes_sold_yoy"),
    newListingsYoy: parseNumberOrNull(row.new_listings_yoy, "new_listings_yoy"),
    avgSaleToListYoy: parseNumberOrNull(row.avg_sale_to_list_yoy, "avg_sale_to_list_yoy"),
    soldAboveListYoy: parseNumberOrNull(row.sold_above_list_yoy, "sold_above_list_yoy"),
    saleToListPctOverUnder: parseNumberOrNull(
      row.sale_to_list_pct_over_under,
      "sale_to_list_pct_over_under"
    ),
    competitivenessScore: parseIntegerOrNull(row.competitiveness_score, "competitiveness_score"),
    competitivenessLabel: parseOptionalString(row.competitiveness_label, "competitiveness_label"),
    competitivenessExplanation: parseOptionalString(
      row.competitiveness_explanation,
      "competitiveness_explanation"
    ),
    confidenceTier: parseOptionalString(row.confidence_tier, "confidence_tier"),
    sourceLastUpdated: parseTimestampOrNull(row.source_last_updated, "source_last_updated")
  };
}

function parseSeriesRow(row: DashboardSeriesRow): ParsedDashboardSeriesRow {
  return {
    periodEnd: parseDate(row.period_end, "period_end"),
    medianSalePrice: parseNumberOrNull(row.median_sale_price, "median_sale_price"),
    medianListPrice: parseNumberOrNull(row.median_list_price, "median_list_price"),
    homesSold: parseIntegerOrNull(row.homes_sold, "homes_sold"),
    newListings: parseIntegerOrNull(row.new_listings, "new_listings"),
    avgSaleToList: parseNumberOrNull(row.avg_sale_to_list, "avg_sale_to_list"),
    soldAboveList: parseNumberOrNull(row.sold_above_list, "sold_above_list"),
    medianSalePriceMom: parseNumberOrNull(row.median_sale_price_mom, "median_sale_price_mom"),
    medianListPriceMom: parseNumberOrNull(row.median_list_price_mom, "median_list_price_mom")
  };
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

async function findNearestSupportedZips(
  executor: SqlExecutor,
  zipCode: string,
  maxResults: number = 5
): Promise<NearestSupportedZipSuggestion[]> {
  const normalizedZipCode = normalizeZipCode(zipCode);
  const normalizedMaxResults = normalizeMaxResults(maxResults);

  const result = await executor.query<NearestSupportedZipRow>(FIND_NEAREST_SUPPORTED_ZIPS_SQL, [
    normalizedZipCode,
    normalizedMaxResults
  ]);

  return result.rows.map((row) => ({
    zipCode: parseRequiredString(row.zip_code, "zip_code"),
    distanceMiles: parseDistanceMiles(row.distance_miles)
  }));
}

function toSuggestionsPayload(
  suggestions: Awaited<ReturnType<typeof findNearestSupportedZips>>
): ZipSuggestion[] {
  return suggestions.slice(0, MAX_SUGGESTIONS).map((suggestion) => ({
    zip: suggestion.zipCode,
    distance_miles: suggestion.distanceMiles
  }));
}

function toPercent(value: number | null): number | null {
  if (value === null) {
    return null;
  }

  return value * 100;
}

async function getZipContext(executor: SqlExecutor, zip: string): Promise<ZipContext | null> {
  const result = await executor.query<ZipContextRow>(ZIP_CONTEXT_SQL, [zip]);
  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return parseZipContext(row);
}

async function getUnsupportedPayload(
  executor: SqlExecutor,
  zip: string
): Promise<DashboardUnsupportedResponse> {
  const suggestions = await findNearestSupportedZips(executor, zip, MAX_SUGGESTIONS);

  return {
    zip,
    status: "unsupported",
    message: DASHBOARD_UNSUPPORTED_MESSAGE,
    nearby_supported_zips: toSuggestionsPayload(suggestions)
  };
}

export async function fetchDashboardWithExecutor(
  executor: SqlExecutor,
  input: DashboardLookupInput
): Promise<DashboardFetchResult> {
  const zipContext = await getZipContext(executor, input.zip);
  if (!zipContext) {
    return { type: "zip_not_found" };
  }

  if (!zipContext.isNj || zipContext.stateCode !== NJ_STATE_CODE) {
    return { type: "non_nj" };
  }

  if (!zipContext.isSupported) {
    return {
      type: "unsupported",
      payload: await getUnsupportedPayload(executor, input.zip)
    };
  }

  const latestResult = await executor.query<LatestDashboardRow>(DASHBOARD_LATEST_SQL, [
    input.zip,
    input.segment
  ]);
  const latestRow = latestResult.rows[0];

  if (!latestRow) {
    return {
      type: "unsupported",
      payload: await getUnsupportedPayload(executor, input.zip)
    };
  }

  const parsedLatestRow = parseLatestDashboardRow(latestRow);

  const seriesResult = await executor.query<DashboardSeriesRow>(DASHBOARD_SERIES_SQL, [
    input.zip,
    input.segment,
    input.months
  ]);

  let parsedSeriesRowsDescending = seriesResult.rows.map((row) => parseSeriesRow(row));
  if (parsedSeriesRowsDescending.length === 0) {
    parsedSeriesRowsDescending = [
      {
        periodEnd: parsedLatestRow.periodEnd,
        medianSalePrice: parsedLatestRow.medianSalePrice,
        medianListPrice: parsedLatestRow.medianListPrice,
        homesSold: parsedLatestRow.homesSold,
        newListings: parsedLatestRow.newListings,
        avgSaleToList: parsedLatestRow.avgSaleToList,
        soldAboveList: parsedLatestRow.soldAboveList,
        medianSalePriceMom: null,
        medianListPriceMom: null
      }
    ];
  }

  const latestSeriesRow = parsedSeriesRowsDescending[0];
  const seriesRows = [...parsedSeriesRowsDescending].reverse();

  return {
    type: "supported",
    payload: {
      zip: input.zip,
      status: "supported",
      segment: input.segment,
      latest_period_end: parsedLatestRow.periodEnd,
      kpis: {
        median_list_price: {
          value: parsedLatestRow.medianListPrice,
          yoy_change: parsedLatestRow.medianListPriceYoy,
          mom_change: latestSeriesRow.medianListPriceMom
        },
        median_sale_price: {
          value: parsedLatestRow.medianSalePrice,
          yoy_change: parsedLatestRow.medianSalePriceYoy,
          mom_change: latestSeriesRow.medianSalePriceMom
        },
        sale_to_list_ratio: {
          value: parsedLatestRow.avgSaleToList,
          over_under_pct: parsedLatestRow.saleToListPctOverUnder,
          yoy_change: parsedLatestRow.avgSaleToListYoy
        },
        sold_over_list_pct: {
          value_pct: toPercent(parsedLatestRow.soldAboveList),
          yoy_change: toPercent(parsedLatestRow.soldAboveListYoy)
        },
        new_listings: {
          value: parsedLatestRow.newListings,
          yoy_change: parsedLatestRow.newListingsYoy
        },
        homes_sold: {
          value: parsedLatestRow.homesSold,
          yoy_change: parsedLatestRow.homesSoldYoy
        }
      },
      series: {
        period_end: seriesRows.map((row) => row.periodEnd),
        median_sale_price: seriesRows.map((row) => row.medianSalePrice),
        median_list_price: seriesRows.map((row) => row.medianListPrice),
        avg_sale_to_list: seriesRows.map((row) => row.avgSaleToList),
        sold_above_list: seriesRows.map((row) => row.soldAboveList),
        new_listings: seriesRows.map((row) => row.newListings),
        homes_sold: seriesRows.map((row) => row.homesSold)
      },
      competitiveness: {
        score: parsedLatestRow.competitivenessScore,
        label: parsedLatestRow.competitivenessLabel,
        explanation: parsedLatestRow.competitivenessExplanation,
        confidence_tier: parsedLatestRow.confidenceTier
      },
      disclaimer: DASHBOARD_DISCLAIMER,
      methodology: {
        source: DASHBOARD_SOURCE,
        last_updated: parsedLatestRow.sourceLastUpdated,
        window_type: DASHBOARD_WINDOW_TYPE
      }
    }
  };
}

export async function fetchZipSuggestionsWithExecutor(
  executor: SqlExecutor,
  zip: string
): Promise<ZipSuggestionsFetchResult> {
  const zipContext = await getZipContext(executor, zip);
  if (!zipContext) {
    return { type: "zip_not_found" };
  }

  if (!zipContext.isNj || zipContext.stateCode !== NJ_STATE_CODE) {
    return { type: "non_nj" };
  }

  const suggestions = await findNearestSupportedZips(executor, zip, MAX_SUGGESTIONS);

  return {
    type: "ok",
    payload: {
      zip,
      suggestions: toSuggestionsPayload(suggestions)
    }
  };
}

async function withDatabaseExecutor<T>(
  callback: (executor: SqlExecutor) => Promise<T>,
  databaseUrl: string = resolveDatabaseUrl()
): Promise<T> {
  const client = createPgClient(databaseUrl);
  await client.connect();

  try {
    return await callback(client);
  } finally {
    await client.end();
  }
}

export async function fetchDashboard(
  input: DashboardLookupInput,
  databaseUrl: string = resolveDatabaseUrl()
): Promise<DashboardFetchResult> {
  return withDatabaseExecutor((executor) => fetchDashboardWithExecutor(executor, input), databaseUrl);
}

export async function fetchZipSuggestions(
  zip: string,
  databaseUrl: string = resolveDatabaseUrl()
): Promise<ZipSuggestionsFetchResult> {
  return withDatabaseExecutor((executor) => fetchZipSuggestionsWithExecutor(executor, zip), databaseUrl);
}
