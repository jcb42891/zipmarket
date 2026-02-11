import { createReadStream } from "node:fs";
import { createGunzip } from "node:zlib";

import { refreshMarts, type RefreshMartsSummary, type SqlExecutor } from "@zipmarket/db";

import {
  runIngestionJob,
  type IngestionJobContext,
  type IngestionSummary
} from "./framework.js";
import { readLines, type LineRecord } from "./line-reader.js";
import {
  evaluateRedfinDataQuality,
  type RedfinDataQualityReport
} from "./redfin-data-quality.js";

const REDFIN_ADVISORY_LOCK_KEY = 209002;

const REQUIRED_REDFIN_COLUMNS = [
  "REGION_TYPE",
  "STATE_CODE",
  "IS_SEASONALLY_ADJUSTED",
  "PROPERTY_TYPE",
  "REGION",
  "PERIOD_BEGIN",
  "PERIOD_END",
  "LAST_UPDATED",
  "MEDIAN_SALE_PRICE",
  "MEDIAN_LIST_PRICE",
  "HOMES_SOLD",
  "NEW_LISTINGS",
  "AVG_SALE_TO_LIST",
  "SOLD_ABOVE_LIST",
  "MEDIAN_SALE_PRICE_MOM",
  "MEDIAN_SALE_PRICE_YOY",
  "MEDIAN_LIST_PRICE_MOM",
  "MEDIAN_LIST_PRICE_YOY",
  "HOMES_SOLD_YOY",
  "NEW_LISTINGS_YOY",
  "AVG_SALE_TO_LIST_YOY",
  "SOLD_ABOVE_LIST_YOY"
] as const;

const PROPERTY_TYPE_BY_SOURCE_VALUE: Record<string, string> = {
  "All Residential": "all",
  "Single Family Residential": "single_family",
  "Condo/Co-op": "condo_coop",
  Townhouse: "townhouse",
  "Multi-Family (2-4 Unit)": "multi_family"
};

const UPSERT_FACT_ZIP_MARKET_SQL = `
INSERT INTO fact_zip_market_monthly (
  zip_code,
  period_begin,
  period_end,
  property_type_key,
  median_sale_price,
  median_list_price,
  homes_sold,
  new_listings,
  avg_sale_to_list,
  sold_above_list,
  median_sale_price_mom,
  median_sale_price_yoy,
  median_list_price_mom,
  median_list_price_yoy,
  homes_sold_yoy,
  new_listings_yoy,
  avg_sale_to_list_yoy,
  sold_above_list_yoy,
  source_last_updated,
  ingestion_run_id
)
VALUES (
  $1,  $2,  $3,  $4,  $5,
  $6,  $7,  $8,  $9,  $10,
  $11, $12, $13, $14, $15,
  $16, $17, $18, $19, $20
)
ON CONFLICT (zip_code, period_end, property_type_key) DO UPDATE
SET
  period_begin = EXCLUDED.period_begin,
  median_sale_price = EXCLUDED.median_sale_price,
  median_list_price = EXCLUDED.median_list_price,
  homes_sold = EXCLUDED.homes_sold,
  new_listings = EXCLUDED.new_listings,
  avg_sale_to_list = EXCLUDED.avg_sale_to_list,
  sold_above_list = EXCLUDED.sold_above_list,
  median_sale_price_mom = EXCLUDED.median_sale_price_mom,
  median_sale_price_yoy = EXCLUDED.median_sale_price_yoy,
  median_list_price_mom = EXCLUDED.median_list_price_mom,
  median_list_price_yoy = EXCLUDED.median_list_price_yoy,
  homes_sold_yoy = EXCLUDED.homes_sold_yoy,
  new_listings_yoy = EXCLUDED.new_listings_yoy,
  avg_sale_to_list_yoy = EXCLUDED.avg_sale_to_list_yoy,
  sold_above_list_yoy = EXCLUDED.sold_above_list_yoy,
  source_last_updated = EXCLUDED.source_last_updated,
  ingestion_run_id = EXCLUDED.ingestion_run_id
`;

interface DimZipStateRow {
  zip_code: string;
  state_code: string;
}

export type RedfinHeaderMap = Record<string, number>;

export interface RedfinNormalizedRecord {
  zipCode: string;
  periodBegin: string;
  periodEnd: string;
  propertyTypeKey: string;
  medianSalePrice: number | null;
  medianListPrice: number | null;
  homesSold: number | null;
  newListings: number | null;
  avgSaleToList: number | null;
  soldAboveList: number | null;
  medianSalePriceMom: number | null;
  medianSalePriceYoy: number | null;
  medianListPriceMom: number | null;
  medianListPriceYoy: number | null;
  homesSoldYoy: number | null;
  newListingsYoy: number | null;
  avgSaleToListYoy: number | null;
  soldAboveListYoy: number | null;
  sourceLastUpdated: string | null;
}

export type ParseRedfinHeaderResult =
  | {
      ok: true;
      headerMap: RedfinHeaderMap;
    }
  | {
      ok: false;
      reason: string;
    };

export type ParseRedfinLineResult =
  | { kind: "skip" }
  | { kind: "reject"; reason: string }
  | { kind: "record"; record: RedfinNormalizedRecord };

export interface RedfinIngestionSummary extends IngestionSummary {
  dataQualityReport: RedfinDataQualityReport;
  martRefresh: RefreshMartsSummary;
}

function normalizeNullableNumber(rawValue: string): number | null | "invalid" {
  const normalized = rawValue.trim();
  if (normalized.length === 0 || normalized.toUpperCase() === "NA") {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : "invalid";
}

function normalizeNullableInteger(rawValue: string): number | null | "invalid" {
  const normalized = normalizeNullableNumber(rawValue);
  if (normalized === null || normalized === "invalid") {
    return normalized;
  }
  return Number.isInteger(normalized) ? normalized : "invalid";
}

function normalizeCell(rawValue: string): string {
  const trimmed = rawValue.trim();
  if (trimmed.startsWith("\"") && trimmed.endsWith("\"") && trimmed.length >= 2) {
    return trimmed.slice(1, -1).replace(/""/g, "\"").trim();
  }
  return trimmed;
}

function normalizeDate(rawValue: string): string | null {
  const normalized = rawValue.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return null;
  }
  return normalized;
}

function normalizeTimestamp(rawValue: string): string | null | "invalid" {
  const normalized = rawValue.trim();
  if (normalized.length === 0 || normalized.toUpperCase() === "NA") {
    return null;
  }
  const parsed = Date.parse(normalized);
  if (Number.isNaN(parsed)) {
    return "invalid";
  }
  return new Date(parsed).toISOString();
}

function normalizeBoolean(rawValue: string): boolean | "invalid" {
  const normalized = rawValue.trim().toLowerCase();
  if (normalized === "true" || normalized === "t" || normalized === "1" || normalized === "yes") {
    return true;
  }
  if (normalized === "false" || normalized === "f" || normalized === "0" || normalized === "no") {
    return false;
  }
  return "invalid";
}

function valueAt(values: string[], headerMap: RedfinHeaderMap, key: string): string {
  const index = headerMap[key];
  return index === undefined ? "" : (values[index] ?? "");
}

function parseNumericField(
  values: string[],
  headerMap: RedfinHeaderMap,
  key: string
): number | null | "invalid" {
  return normalizeNullableNumber(valueAt(values, headerMap, key));
}

function parseIntegerField(
  values: string[],
  headerMap: RedfinHeaderMap,
  key: string
): number | null | "invalid" {
  return normalizeNullableInteger(valueAt(values, headerMap, key));
}

function parseZipFromRegion(regionValue: string): string | null {
  const match = regionValue.match(/Zip Code:\s*(\d{5})/i);
  return match?.[1] ?? null;
}

export function parseRedfinHeader(headerLine: string): ParseRedfinHeaderResult {
  const headerMap: RedfinHeaderMap = {};
  headerLine.split("\t").forEach((columnName, index) => {
    const trimmed = normalizeCell(columnName);
    if (trimmed.length > 0 && headerMap[trimmed] === undefined) {
      headerMap[trimmed] = index;
    }
  });

  const missingColumns = REQUIRED_REDFIN_COLUMNS.filter(
    (columnName) => headerMap[columnName] === undefined
  );
  if (missingColumns.length > 0) {
    return {
      ok: false,
      reason: `missing_required_columns:${missingColumns.join(",")}`
    };
  }

  return {
    ok: true,
    headerMap
  };
}

export function parseRedfinLine(
  line: string,
  headerMap: RedfinHeaderMap,
  zipStateByZip: ReadonlyMap<string, string>
): ParseRedfinLineResult {
  const values = line.split("\t").map((value) => normalizeCell(value));

  const regionType = valueAt(values, headerMap, "REGION_TYPE").trim().toLowerCase();
  if (regionType !== "zip code") {
    return { kind: "skip" };
  }

  const stateCode = valueAt(values, headerMap, "STATE_CODE").trim().toUpperCase();
  if (stateCode !== "NJ") {
    return { kind: "skip" };
  }

  const isSeasonallyAdjusted = normalizeBoolean(
    valueAt(values, headerMap, "IS_SEASONALLY_ADJUSTED")
  );
  if (isSeasonallyAdjusted === "invalid") {
    return { kind: "reject", reason: "invalid_is_seasonally_adjusted" };
  }
  if (isSeasonallyAdjusted) {
    return { kind: "skip" };
  }

  const zipCode = parseZipFromRegion(valueAt(values, headerMap, "REGION"));
  if (!zipCode) {
    return { kind: "reject", reason: "invalid_region_zip_code" };
  }

  const metadataStateCode = zipStateByZip.get(zipCode)?.toUpperCase();
  if (!metadataStateCode) {
    return { kind: "reject", reason: "zip_not_found_in_dim_zip" };
  }
  if (metadataStateCode !== "NJ") {
    return { kind: "reject", reason: "zip_state_mismatch" };
  }

  const propertyType = valueAt(values, headerMap, "PROPERTY_TYPE").trim();
  const propertyTypeKey = PROPERTY_TYPE_BY_SOURCE_VALUE[propertyType];
  if (!propertyTypeKey) {
    return { kind: "reject", reason: "unknown_property_type" };
  }

  const periodBegin = normalizeDate(valueAt(values, headerMap, "PERIOD_BEGIN"));
  if (!periodBegin) {
    return { kind: "reject", reason: "invalid_period_begin" };
  }

  const periodEnd = normalizeDate(valueAt(values, headerMap, "PERIOD_END"));
  if (!periodEnd) {
    return { kind: "reject", reason: "invalid_period_end" };
  }

  const sourceLastUpdated = normalizeTimestamp(valueAt(values, headerMap, "LAST_UPDATED"));
  if (sourceLastUpdated === "invalid") {
    return { kind: "reject", reason: "invalid_last_updated" };
  }

  const homesSold = parseIntegerField(values, headerMap, "HOMES_SOLD");
  if (homesSold === "invalid") {
    return { kind: "reject", reason: "invalid_homes_sold" };
  }

  const newListings = parseIntegerField(values, headerMap, "NEW_LISTINGS");
  if (newListings === "invalid") {
    return { kind: "reject", reason: "invalid_new_listings" };
  }

  const medianSalePrice = parseNumericField(values, headerMap, "MEDIAN_SALE_PRICE");
  if (medianSalePrice === "invalid") {
    return { kind: "reject", reason: "invalid_median_sale_price" };
  }

  const medianListPrice = parseNumericField(values, headerMap, "MEDIAN_LIST_PRICE");
  if (medianListPrice === "invalid") {
    return { kind: "reject", reason: "invalid_median_list_price" };
  }

  const avgSaleToList = parseNumericField(values, headerMap, "AVG_SALE_TO_LIST");
  if (avgSaleToList === "invalid") {
    return { kind: "reject", reason: "invalid_avg_sale_to_list" };
  }

  const soldAboveList = parseNumericField(values, headerMap, "SOLD_ABOVE_LIST");
  if (soldAboveList === "invalid") {
    return { kind: "reject", reason: "invalid_sold_above_list" };
  }

  const medianSalePriceMom = parseNumericField(values, headerMap, "MEDIAN_SALE_PRICE_MOM");
  if (medianSalePriceMom === "invalid") {
    return { kind: "reject", reason: "invalid_median_sale_price_mom" };
  }

  const medianSalePriceYoy = parseNumericField(values, headerMap, "MEDIAN_SALE_PRICE_YOY");
  if (medianSalePriceYoy === "invalid") {
    return { kind: "reject", reason: "invalid_median_sale_price_yoy" };
  }

  const medianListPriceMom = parseNumericField(values, headerMap, "MEDIAN_LIST_PRICE_MOM");
  if (medianListPriceMom === "invalid") {
    return { kind: "reject", reason: "invalid_median_list_price_mom" };
  }

  const medianListPriceYoy = parseNumericField(values, headerMap, "MEDIAN_LIST_PRICE_YOY");
  if (medianListPriceYoy === "invalid") {
    return { kind: "reject", reason: "invalid_median_list_price_yoy" };
  }

  const homesSoldYoy = parseNumericField(values, headerMap, "HOMES_SOLD_YOY");
  if (homesSoldYoy === "invalid") {
    return { kind: "reject", reason: "invalid_homes_sold_yoy" };
  }

  const newListingsYoy = parseNumericField(values, headerMap, "NEW_LISTINGS_YOY");
  if (newListingsYoy === "invalid") {
    return { kind: "reject", reason: "invalid_new_listings_yoy" };
  }

  const avgSaleToListYoy = parseNumericField(values, headerMap, "AVG_SALE_TO_LIST_YOY");
  if (avgSaleToListYoy === "invalid") {
    return { kind: "reject", reason: "invalid_avg_sale_to_list_yoy" };
  }

  const soldAboveListYoy = parseNumericField(values, headerMap, "SOLD_ABOVE_LIST_YOY");
  if (soldAboveListYoy === "invalid") {
    return { kind: "reject", reason: "invalid_sold_above_list_yoy" };
  }

  return {
    kind: "record",
    record: {
      zipCode,
      periodBegin,
      periodEnd,
      propertyTypeKey,
      medianSalePrice,
      medianListPrice,
      homesSold,
      newListings,
      avgSaleToList,
      soldAboveList,
      medianSalePriceMom,
      medianSalePriceYoy,
      medianListPriceMom,
      medianListPriceYoy,
      homesSoldYoy,
      newListingsYoy,
      avgSaleToListYoy,
      soldAboveListYoy,
      sourceLastUpdated
    }
  };
}

function createRedfinSourceStream(filePath: string): NodeJS.ReadableStream {
  if (filePath.toLowerCase().endsWith(".gz")) {
    return createReadStream(filePath).pipe(createGunzip());
  }
  return createReadStream(filePath, { encoding: "utf8" });
}

async function upsertFactZipMarketMonthly(
  executor: SqlExecutor,
  record: RedfinNormalizedRecord,
  ingestionRunId: string
): Promise<void> {
  await executor.query(UPSERT_FACT_ZIP_MARKET_SQL, [
    record.zipCode,
    record.periodBegin,
    record.periodEnd,
    record.propertyTypeKey,
    record.medianSalePrice,
    record.medianListPrice,
    record.homesSold,
    record.newListings,
    record.avgSaleToList,
    record.soldAboveList,
    record.medianSalePriceMom,
    record.medianSalePriceYoy,
    record.medianListPriceMom,
    record.medianListPriceYoy,
    record.homesSoldYoy,
    record.newListingsYoy,
    record.avgSaleToListYoy,
    record.soldAboveListYoy,
    record.sourceLastUpdated,
    ingestionRunId
  ]);
}

export async function loadZipStateMap(executor: SqlExecutor): Promise<Map<string, string>> {
  const result = await executor.query<DimZipStateRow>(`
SELECT zip_code, state_code
FROM dim_zip
`);
  return new Map(
    result.rows.map((row) => [row.zip_code.trim(), row.state_code.trim().toUpperCase()])
  );
}

export async function ingestRedfinLines(
  lines: AsyncIterable<LineRecord>,
  zipStateByZip: ReadonlyMap<string, string>,
  context: Pick<
    IngestionJobContext,
    "runId" | "executor" | "incrementRowsRead" | "incrementRowsWritten" | "reject"
  >
): Promise<void> {
  let headerMap: RedfinHeaderMap | null = null;

  for await (const { lineNumber, line } of lines) {
    if (line.trim().length === 0) {
      continue;
    }

    if (!headerMap) {
      const parsedHeader = parseRedfinHeader(line);
      if (!parsedHeader.ok) {
        throw new Error(`Redfin header validation failed: ${parsedHeader.reason}`);
      }
      headerMap = parsedHeader.headerMap;
      continue;
    }

    context.incrementRowsRead();
    const parsedLine = parseRedfinLine(line, headerMap, zipStateByZip);
    if (parsedLine.kind === "skip") {
      continue;
    }
    if (parsedLine.kind === "reject") {
      await context.reject({
        lineNumber,
        reason: parsedLine.reason,
        rawPayload: line
      });
      continue;
    }

    await upsertFactZipMarketMonthly(context.executor, parsedLine.record, context.runId);
    context.incrementRowsWritten();
  }

  if (!headerMap) {
    throw new Error("Redfin source file is empty.");
  }
}

export async function runRedfinIngestion(
  executor: SqlExecutor,
  sourceUrl: string
): Promise<RedfinIngestionSummary> {
  let rowsRead = 0;
  let rowsRejected = 0;
  let dataQualityReport: RedfinDataQualityReport | null = null;
  let martRefreshSummary: RefreshMartsSummary | null = null;

  const summary = await runIngestionJob(
    executor,
    {
      sourceName: "redfin",
      sourceUrl,
      advisoryLockKey: REDFIN_ADVISORY_LOCK_KEY
    },
    {
      execute: async (context) => {
        const zipStateByZip = await loadZipStateMap(context.executor);
        const sourceStream = createRedfinSourceStream(context.downloadedSource.filePath);
        await ingestRedfinLines(readLines(sourceStream), zipStateByZip, {
          ...context,
          incrementRowsRead: (count = 1) => {
            rowsRead += count;
            context.incrementRowsRead(count);
          },
          reject: async (record) => {
            rowsRejected += 1;
            await context.reject(record);
          }
        });

        dataQualityReport = await evaluateRedfinDataQuality(context.executor, {
          runId: context.runId,
          rowsRead,
          rowsRejected
        });

        if (dataQualityReport.hardFailureReasons.length > 0) {
          throw new Error(
            `Redfin data quality hard-fail: ${dataQualityReport.hardFailureReasons.join("; ")}`
          );
        }

        martRefreshSummary = await refreshMarts(context.executor);
      }
    }
  );

  if (!dataQualityReport) {
    throw new Error("Expected Redfin data quality report to be generated.");
  }

  if (!martRefreshSummary) {
    throw new Error("Expected marts refresh to run after Redfin ingestion.");
  }

  return {
    ...summary,
    dataQualityReport,
    martRefresh: martRefreshSummary
  };
}
