import assert from "node:assert/strict";
import test from "node:test";

import type { QueryResult, SqlExecutor } from "@zipmarket/db";

import {
  evaluateRedfinDataQuality,
  formatRedfinDataQualityReport
} from "./redfin-data-quality.js";

interface FakeCoverage {
  totalRows: number;
  medianSalePriceNonNull: number;
  homesSoldNonNull: number;
  avgSaleToListNonNull: number;
  soldAboveListNonNull: number;
}

interface FakeData {
  latestPeriodByRun: Record<string, string | null>;
  previousRunByRun: Record<string, string | null>;
  rowCountByRunPeriod: Record<string, number>;
  coverageByRunPeriod: Record<string, FakeCoverage>;
  unknownPropertyTypeRejectsByRun: Record<string, number>;
}

class FakeExecutor implements SqlExecutor {
  public readonly calls: Array<{ text: string; params?: readonly unknown[] }> = [];

  public constructor(private readonly data: FakeData) {}

  public async query<Row = unknown>(
    text: string,
    params?: readonly unknown[]
  ): Promise<QueryResult<Row>> {
    this.calls.push({ text, params });

    if (text.includes("MAX(period_end)::TEXT AS latest_period_end")) {
      const runId = String(params?.[0] ?? "");
      return {
        rows: [{ latest_period_end: this.data.latestPeriodByRun[runId] ?? null }] as Row[],
        rowCount: 1
      };
    }

    if (text.includes("FROM ingestion_run") && text.includes("source_name = 'redfin'")) {
      const runId = String(params?.[0] ?? "");
      const previousRunId = this.data.previousRunByRun[runId] ?? null;
      return {
        rows: previousRunId ? ([{ run_id: previousRunId }] as Row[]) : [],
        rowCount: previousRunId ? 1 : 0
      };
    }

    if (text.includes("COUNT(*)::INT AS row_count") && text.includes("period_end = $2")) {
      const runId = String(params?.[0] ?? "");
      const periodEnd = String(params?.[1] ?? "");
      const key = `${runId}|${periodEnd}`;
      return {
        rows: [{ row_count: this.data.rowCountByRunPeriod[key] ?? 0 }] as Row[],
        rowCount: 1
      };
    }

    if (text.includes("COUNT(*)::INT AS total_rows")) {
      const runId = String(params?.[0] ?? "");
      const periodEnd = String(params?.[1] ?? "");
      const key = `${runId}|${periodEnd}`;
      const coverage = this.data.coverageByRunPeriod[key] ?? {
        totalRows: 0,
        medianSalePriceNonNull: 0,
        homesSoldNonNull: 0,
        avgSaleToListNonNull: 0,
        soldAboveListNonNull: 0
      };

      return {
        rows: [
          {
            total_rows: coverage.totalRows,
            median_sale_price_non_null: coverage.medianSalePriceNonNull,
            homes_sold_non_null: coverage.homesSoldNonNull,
            avg_sale_to_list_non_null: coverage.avgSaleToListNonNull,
            sold_above_list_non_null: coverage.soldAboveListNonNull
          }
        ] as Row[],
        rowCount: 1
      };
    }

    if (text.includes("FROM ingestion_reject")) {
      const runId = String(params?.[0] ?? "");
      return {
        rows: [
          {
            row_count: this.data.unknownPropertyTypeRejectsByRun[runId] ?? 0
          }
        ] as Row[],
        rowCount: 1
      };
    }

    return {
      rows: [],
      rowCount: 0
    };
  }
}

test("evaluateRedfinDataQuality reports hard failures and warnings from thresholds", async () => {
  const executor = new FakeExecutor({
    latestPeriodByRun: {
      "run-current": "2025-11-30",
      "run-prev": "2025-12-31"
    },
    previousRunByRun: {
      "run-current": "run-prev"
    },
    rowCountByRunPeriod: {
      "run-current|2025-11-30": 80,
      "run-prev|2025-12-31": 100
    },
    coverageByRunPeriod: {
      "run-current|2025-11-30": {
        totalRows: 80,
        medianSalePriceNonNull: 70,
        homesSoldNonNull: 80,
        avgSaleToListNonNull: 80,
        soldAboveListNonNull: 80
      }
    },
    unknownPropertyTypeRejectsByRun: {
      "run-current": 2
    }
  });

  const report = await evaluateRedfinDataQuality(executor, {
    runId: "run-current",
    rowsRead: 1000,
    rowsRejected: 12
  });

  assert.equal(report.latestPeriodEnd, "2025-11-30");
  assert.equal(report.previousLatestPeriodEnd, "2025-12-31");
  assert.equal(report.latestNjRowCount, 80);
  assert.equal(report.previousLatestNjRowCount, 100);
  assert.equal(report.unknownPropertyTypeRejects, 2);
  assert.equal(report.parseErrorRate, 0.012);
  assert.ok(report.hardFailureReasons.some((reason) => reason.includes("parse_error_rate_exceeded")));
  assert.ok(report.hardFailureReasons.some((reason) => reason.includes("latest_period_regressed")));
  assert.ok(report.warnings.some((warning) => warning.includes("latest_row_count_drop")));
  assert.ok(report.warnings.some((warning) => warning.includes("median_sale_price_coverage_low")));
  assert.ok(report.warnings.some((warning) => warning.includes("unknown_property_type_detected")));
});

test("evaluateRedfinDataQuality returns a clean report when metrics pass thresholds", async () => {
  const executor = new FakeExecutor({
    latestPeriodByRun: {
      "run-current": "2026-01-31",
      "run-prev": "2025-12-31"
    },
    previousRunByRun: {
      "run-current": "run-prev"
    },
    rowCountByRunPeriod: {
      "run-current|2026-01-31": 100,
      "run-prev|2025-12-31": 95
    },
    coverageByRunPeriod: {
      "run-current|2026-01-31": {
        totalRows: 100,
        medianSalePriceNonNull: 97,
        homesSoldNonNull: 98,
        avgSaleToListNonNull: 99,
        soldAboveListNonNull: 96
      }
    },
    unknownPropertyTypeRejectsByRun: {
      "run-current": 0
    }
  });

  const report = await evaluateRedfinDataQuality(executor, {
    runId: "run-current",
    rowsRead: 1000,
    rowsRejected: 2
  });

  assert.equal(report.hardFailureReasons.length, 0);
  assert.equal(report.warnings.length, 0);

  const formatted = formatRedfinDataQualityReport(report);
  assert.match(formatted, /redfin data_quality/);
  assert.match(formatted, /hard_failures=none/);
});
