import assert from "node:assert/strict";
import test from "node:test";

import type { DashboardSupportedResponse } from "../api/contracts";
import {
  buildDashboardPayloadForDateRange,
  normalizeDateRangeSelection,
  resolveDashboardDateBounds
} from "./date-range";

function createPayload(): DashboardSupportedResponse {
  return {
    zip: "07001",
    status: "supported",
    segment: "all",
    latest_period_end: "2025-12-31",
    kpis: {
      median_list_price: {
        value: 520000,
        yoy_change: 0.1555555556,
        mom_change: 0.0196078431
      },
      median_sale_price: {
        value: 515000,
        yoy_change: 0.1704545455,
        mom_change: 0.03
      },
      sale_to_list_ratio: {
        value: 1.02,
        over_under_pct: 2,
        yoy_change: 0.0408163265
      },
      sold_over_list_pct: {
        value_pct: 40,
        yoy_change: 300
      },
      new_listings: {
        value: 25,
        yoy_change: 0.25
      },
      homes_sold: {
        value: 24,
        yoy_change: 0.3333333333
      }
    },
    series: {
      period_end: ["2024-12-31", "2025-10-31", "2025-11-30", "2025-12-31"],
      median_sale_price: [440000, 490000, 500000, 515000],
      median_list_price: [450000, 500000, 510000, 520000],
      avg_sale_to_list: [0.98, 1, 1.01, 1.02],
      sold_above_list: [0.1, 0.2, 0.3, 0.4],
      new_listings: [20, 30, 28, 25],
      homes_sold: [18, 22, 21, 24]
    },
    competitiveness: {
      score: 2,
      label: "Balanced",
      explanation:
        "A meaningful share of homes are selling over list. Prices are landing at/above asking.",
      confidence_tier: "insufficient"
    },
    disclaimer:
      "This dashboard is based on closed sales and aggregated market data. It is not a live listings feed and does not reflect currently active homes.",
    methodology: {
      source: "Redfin Data Center",
      last_updated: "2026-01-10T10:00:00.000Z",
      window_type: "rolling_monthly_aggregates"
    }
  };
}

test("resolveDashboardDateBounds returns series min and max period ends", () => {
  const bounds = resolveDashboardDateBounds(createPayload());

  assert.deepEqual(bounds, {
    minDate: "2024-12-31",
    maxDate: "2025-12-31"
  });
});

test("normalizeDateRangeSelection clamps dates and preserves valid ordering", () => {
  const normalized = normalizeDateRangeSelection(
    {
      startDate: "2026-06-01",
      endDate: "2024-01-01"
    },
    {
      minDate: "2024-12-31",
      maxDate: "2025-12-31"
    }
  );

  assert.deepEqual(normalized, {
    startDate: "2025-12-31",
    endDate: "2025-12-31"
  });
});

test("buildDashboardPayloadForDateRange filters series and recalculates all dashboard cards", () => {
  const payload = createPayload();

  const rangedPayload = buildDashboardPayloadForDateRange(payload, {
    startDate: "2025-11-01",
    endDate: "2025-12-31"
  });

  assert.deepEqual(rangedPayload.series.period_end, ["2025-11-30", "2025-12-31"]);
  assert.equal(rangedPayload.latest_period_end, "2025-12-31");

  assert.equal(rangedPayload.kpis.median_list_price.value, 515000);
  assert.equal(rangedPayload.kpis.median_sale_price.value, 507500);
  assert.ok(
    Math.abs((rangedPayload.kpis.sale_to_list_ratio.value ?? 0) - 0.9854368932) < 0.000001
  );
  assert.ok(
    Math.abs((rangedPayload.kpis.sale_to_list_ratio.over_under_pct ?? 0) - -1.4563106796) <
      0.000001
  );
  assert.equal(rangedPayload.kpis.sold_over_list_pct.value_pct, 35);
  assert.equal(rangedPayload.kpis.new_listings.value, 53);
  assert.equal(rangedPayload.kpis.homes_sold.value, 45);

  assert.equal(rangedPayload.competitiveness.score, 1);
  assert.equal(rangedPayload.competitiveness.label, "Balanced");
  assert.equal(
    rangedPayload.competitiveness.explanation,
    "A meaningful share of homes are selling over list. New listings are up from last year."
  );
  assert.equal(rangedPayload.competitiveness.confidence_tier, "insufficient");

  assert.ok(rangedPayload.kpis.median_list_price.yoy_change !== null);
  assert.ok(rangedPayload.kpis.median_sale_price.yoy_change !== null);
  assert.ok(
    Math.abs((rangedPayload.kpis.sale_to_list_ratio.yoy_change ?? 0) - 0.0066298343) < 0.000001
  );
  assert.ok(rangedPayload.kpis.sold_over_list_pct.yoy_change !== null);
  assert.ok(rangedPayload.kpis.new_listings.yoy_change !== null);
  assert.ok(rangedPayload.kpis.homes_sold.yoy_change !== null);
});

test("buildDashboardPayloadForDateRange updates KPI card values when only start date changes", () => {
  const payload = createPayload();

  const fullWindowPayload = buildDashboardPayloadForDateRange(payload, {
    startDate: "2024-12-31",
    endDate: "2025-12-31"
  });
  const narrowWindowPayload = buildDashboardPayloadForDateRange(payload, {
    startDate: "2025-11-01",
    endDate: "2025-12-31"
  });

  assert.equal(fullWindowPayload.kpis.median_list_price.value, 495000);
  assert.equal(narrowWindowPayload.kpis.median_list_price.value, 515000);
  assert.equal(fullWindowPayload.kpis.new_listings.value, 103);
  assert.equal(narrowWindowPayload.kpis.new_listings.value, 53);
});
