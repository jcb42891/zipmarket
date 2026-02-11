import type { SqlExecutor } from "@zipmarket/db";

export interface RedfinDataQualityThresholds {
  maxParseErrorRate: number;
  maxLatestRowCountDrop: number;
  minCoreMetricCoverage: number;
}

export const DEFAULT_REDFIN_DATA_QUALITY_THRESHOLDS: RedfinDataQualityThresholds = {
  maxParseErrorRate: 0.005,
  maxLatestRowCountDrop: 0.15,
  minCoreMetricCoverage: 0.95
};

export interface RedfinCoreMetricCoverage {
  medianSalePrice: number;
  homesSold: number;
  avgSaleToList: number;
  soldAboveList: number;
}

export interface RedfinDataQualityReport {
  runId: string;
  rowsRead: number;
  rowsRejected: number;
  parseErrorRate: number;
  latestPeriodEnd: string | null;
  previousLatestPeriodEnd: string | null;
  latestNjRowCount: number;
  previousLatestNjRowCount: number | null;
  unknownPropertyTypeRejects: number;
  coreMetricCoverage: RedfinCoreMetricCoverage;
  warnings: string[];
  hardFailureReasons: string[];
}

interface LatestPeriodRow {
  latest_period_end: string | null;
}

interface CountRow {
  row_count: number | string;
}

interface CoverageRow {
  total_rows: number | string;
  median_sale_price_non_null: number | string;
  homes_sold_non_null: number | string;
  avg_sale_to_list_non_null: number | string;
  sold_above_list_non_null: number | string;
}

interface PreviousRunRow {
  run_id: string;
}

const SELECT_LATEST_PERIOD_FOR_RUN_SQL = `
SELECT MAX(period_end)::TEXT AS latest_period_end
FROM fact_zip_market_monthly
WHERE ingestion_run_id = $1
  AND property_type_key = 'all'
`;

const SELECT_PREVIOUS_SUCCESSFUL_REDFIN_RUN_SQL = `
SELECT run_id
FROM ingestion_run
WHERE source_name = 'redfin'
  AND status = 'succeeded'
  AND run_id <> $1
ORDER BY COALESCE(finished_at, started_at) DESC, run_id DESC
LIMIT 1
`;

const SELECT_LATEST_ROW_COUNT_FOR_RUN_PERIOD_SQL = `
SELECT COUNT(*)::INT AS row_count
FROM fact_zip_market_monthly
WHERE ingestion_run_id = $1
  AND property_type_key = 'all'
  AND period_end = $2
`;

const SELECT_CORE_METRIC_COVERAGE_SQL = `
SELECT
  COUNT(*)::INT AS total_rows,
  COUNT(*) FILTER (WHERE median_sale_price IS NOT NULL)::INT AS median_sale_price_non_null,
  COUNT(*) FILTER (WHERE homes_sold IS NOT NULL)::INT AS homes_sold_non_null,
  COUNT(*) FILTER (WHERE avg_sale_to_list IS NOT NULL)::INT AS avg_sale_to_list_non_null,
  COUNT(*) FILTER (WHERE sold_above_list IS NOT NULL)::INT AS sold_above_list_non_null
FROM fact_zip_market_monthly
WHERE ingestion_run_id = $1
  AND property_type_key = 'all'
  AND period_end = $2
`;

const SELECT_UNKNOWN_PROPERTY_TYPE_REJECT_COUNT_SQL = `
SELECT COUNT(*)::INT AS row_count
FROM ingestion_reject
WHERE ingestion_run_id = $1
  AND source_name = 'redfin'
  AND reject_reason = 'unknown_property_type'
`;

function parseCount(value: unknown, fieldName: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Expected ${fieldName} to be a non-negative integer, received ${value}.`);
  }
  return parsed;
}

function toCoverageRatio(nonNullCount: number, totalCount: number): number {
  if (totalCount <= 0) {
    return 0;
  }
  return nonNullCount / totalCount;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function normalizeThresholds(
  overrides: Partial<RedfinDataQualityThresholds> | undefined
): RedfinDataQualityThresholds {
  return {
    maxParseErrorRate: overrides?.maxParseErrorRate ?? DEFAULT_REDFIN_DATA_QUALITY_THRESHOLDS.maxParseErrorRate,
    maxLatestRowCountDrop:
      overrides?.maxLatestRowCountDrop ?? DEFAULT_REDFIN_DATA_QUALITY_THRESHOLDS.maxLatestRowCountDrop,
    minCoreMetricCoverage:
      overrides?.minCoreMetricCoverage ?? DEFAULT_REDFIN_DATA_QUALITY_THRESHOLDS.minCoreMetricCoverage
  };
}

async function selectLatestPeriodForRun(
  executor: SqlExecutor,
  runId: string
): Promise<string | null> {
  const result = await executor.query<LatestPeriodRow>(SELECT_LATEST_PERIOD_FOR_RUN_SQL, [runId]);
  return result.rows[0]?.latest_period_end ?? null;
}

async function selectLatestRowCountForRunPeriod(
  executor: SqlExecutor,
  runId: string,
  periodEnd: string
): Promise<number> {
  const result = await executor.query<CountRow>(SELECT_LATEST_ROW_COUNT_FOR_RUN_PERIOD_SQL, [
    runId,
    periodEnd
  ]);
  return parseCount(result.rows[0]?.row_count ?? 0, "latest_row_count");
}

async function selectCoreMetricCoverage(
  executor: SqlExecutor,
  runId: string,
  periodEnd: string
): Promise<RedfinCoreMetricCoverage> {
  const result = await executor.query<CoverageRow>(SELECT_CORE_METRIC_COVERAGE_SQL, [runId, periodEnd]);
  const row = result.rows[0];

  if (!row) {
    return {
      medianSalePrice: 0,
      homesSold: 0,
      avgSaleToList: 0,
      soldAboveList: 0
    };
  }

  const totalRows = parseCount(row.total_rows, "coverage_total_rows");
  const medianSalePriceNonNull = parseCount(
    row.median_sale_price_non_null,
    "median_sale_price_non_null"
  );
  const homesSoldNonNull = parseCount(row.homes_sold_non_null, "homes_sold_non_null");
  const avgSaleToListNonNull = parseCount(
    row.avg_sale_to_list_non_null,
    "avg_sale_to_list_non_null"
  );
  const soldAboveListNonNull = parseCount(
    row.sold_above_list_non_null,
    "sold_above_list_non_null"
  );

  return {
    medianSalePrice: toCoverageRatio(medianSalePriceNonNull, totalRows),
    homesSold: toCoverageRatio(homesSoldNonNull, totalRows),
    avgSaleToList: toCoverageRatio(avgSaleToListNonNull, totalRows),
    soldAboveList: toCoverageRatio(soldAboveListNonNull, totalRows)
  };
}

async function selectUnknownPropertyTypeRejectCount(
  executor: SqlExecutor,
  runId: string
): Promise<number> {
  const result = await executor.query<CountRow>(SELECT_UNKNOWN_PROPERTY_TYPE_REJECT_COUNT_SQL, [runId]);
  return parseCount(result.rows[0]?.row_count ?? 0, "unknown_property_type_reject_count");
}

async function selectPreviousSuccessfulRedfinRunId(
  executor: SqlExecutor,
  runId: string
): Promise<string | null> {
  const result = await executor.query<PreviousRunRow>(SELECT_PREVIOUS_SUCCESSFUL_REDFIN_RUN_SQL, [
    runId
  ]);
  return result.rows[0]?.run_id ?? null;
}

export async function evaluateRedfinDataQuality(
  executor: SqlExecutor,
  input: {
    runId: string;
    rowsRead: number;
    rowsRejected: number;
    thresholds?: Partial<RedfinDataQualityThresholds>;
  }
): Promise<RedfinDataQualityReport> {
  const thresholds = normalizeThresholds(input.thresholds);

  const rowsRead = parseCount(input.rowsRead, "rowsRead");
  const rowsRejected = parseCount(input.rowsRejected, "rowsRejected");
  const parseErrorRate = rowsRead === 0 ? 0 : rowsRejected / rowsRead;

  const latestPeriodEnd = await selectLatestPeriodForRun(executor, input.runId);
  const latestNjRowCount =
    latestPeriodEnd === null
      ? 0
      : await selectLatestRowCountForRunPeriod(executor, input.runId, latestPeriodEnd);
  const coreMetricCoverage =
    latestPeriodEnd === null
      ? {
          medianSalePrice: 0,
          homesSold: 0,
          avgSaleToList: 0,
          soldAboveList: 0
        }
      : await selectCoreMetricCoverage(executor, input.runId, latestPeriodEnd);

  const previousRunId = await selectPreviousSuccessfulRedfinRunId(executor, input.runId);
  const previousLatestPeriodEnd =
    previousRunId === null ? null : await selectLatestPeriodForRun(executor, previousRunId);
  const previousLatestNjRowCount =
    previousRunId === null || previousLatestPeriodEnd === null
      ? null
      : await selectLatestRowCountForRunPeriod(executor, previousRunId, previousLatestPeriodEnd);

  const unknownPropertyTypeRejects = await selectUnknownPropertyTypeRejectCount(executor, input.runId);

  const warnings: string[] = [];
  const hardFailureReasons: string[] = [];

  if (parseErrorRate > thresholds.maxParseErrorRate) {
    hardFailureReasons.push(
      `parse_error_rate_exceeded:${formatPercent(parseErrorRate)}>${formatPercent(
        thresholds.maxParseErrorRate
      )}`
    );
  }

  if (
    latestPeriodEnd !== null &&
    previousLatestPeriodEnd !== null &&
    latestPeriodEnd < previousLatestPeriodEnd
  ) {
    hardFailureReasons.push(
      `latest_period_regressed:${latestPeriodEnd}<${previousLatestPeriodEnd}`
    );
  }

  if (
    previousLatestNjRowCount !== null &&
    previousLatestNjRowCount > 0 &&
    latestNjRowCount < previousLatestNjRowCount * (1 - thresholds.maxLatestRowCountDrop)
  ) {
    const dropRatio = 1 - latestNjRowCount / previousLatestNjRowCount;
    warnings.push(
      `latest_row_count_drop:${latestNjRowCount}<${previousLatestNjRowCount}(${formatPercent(
        dropRatio
      )} drop)`
    );
  }

  if (latestPeriodEnd !== null && latestNjRowCount > 0) {
    if (coreMetricCoverage.medianSalePrice < thresholds.minCoreMetricCoverage) {
      warnings.push(
        `median_sale_price_coverage_low:${formatPercent(coreMetricCoverage.medianSalePrice)}`
      );
    }
    if (coreMetricCoverage.homesSold < thresholds.minCoreMetricCoverage) {
      warnings.push(`homes_sold_coverage_low:${formatPercent(coreMetricCoverage.homesSold)}`);
    }
    if (coreMetricCoverage.avgSaleToList < thresholds.minCoreMetricCoverage) {
      warnings.push(
        `avg_sale_to_list_coverage_low:${formatPercent(coreMetricCoverage.avgSaleToList)}`
      );
    }
    if (coreMetricCoverage.soldAboveList < thresholds.minCoreMetricCoverage) {
      warnings.push(
        `sold_above_list_coverage_low:${formatPercent(coreMetricCoverage.soldAboveList)}`
      );
    }
  }

  if (unknownPropertyTypeRejects > 0) {
    warnings.push(`unknown_property_type_detected:${unknownPropertyTypeRejects}`);
  }

  return {
    runId: input.runId,
    rowsRead,
    rowsRejected,
    parseErrorRate,
    latestPeriodEnd,
    previousLatestPeriodEnd,
    latestNjRowCount,
    previousLatestNjRowCount,
    unknownPropertyTypeRejects,
    coreMetricCoverage,
    warnings,
    hardFailureReasons
  };
}

export function formatRedfinDataQualityReport(report: RedfinDataQualityReport): string {
  const warningText = report.warnings.length > 0 ? report.warnings.join(",") : "none";
  const hardFailureText =
    report.hardFailureReasons.length > 0 ? report.hardFailureReasons.join(",") : "none";

  return [
    "[etl] redfin data_quality",
    `run_id=${report.runId}`,
    `latest_period_end=${report.latestPeriodEnd ?? "none"}`,
    `rows_read=${report.rowsRead}`,
    `rows_rejected=${report.rowsRejected}`,
    `parse_error_rate=${formatPercent(report.parseErrorRate)}`,
    `latest_nj_row_count=${report.latestNjRowCount}`,
    `warnings=${warningText}`,
    `hard_failures=${hardFailureText}`
  ].join(" ");
}
