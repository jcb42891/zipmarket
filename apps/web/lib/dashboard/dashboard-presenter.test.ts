import assert from "node:assert/strict";
import test from "node:test";

import type { DashboardSupportedResponse } from "../api/contracts";
import {
  METRIC_TOOLTIP_COPY,
  buildChartRows,
  buildKpiCards,
  formatLocationHeading,
  formatCount,
  formatCurrency,
  formatPeriodLabel,
  formatRatio,
  formatSignedPercent,
  formatSignedPercentChange,
  toSegmentLabel
} from "./dashboard-presenter";

function createPayload(): DashboardSupportedResponse {
  return {
    zip: "07001",
    status: "supported",
    segment: "all",
    latest_period_end: "2025-12-31",
    kpis: {
      median_list_price: { value: 580000, yoy_change: 0.05, mom_change: 0.01 },
      median_sale_price: { value: 570000, yoy_change: 0.06, mom_change: 0.02 },
      sale_to_list_ratio: {
        value: 1.015,
        over_under_pct: 1.5,
        yoy_change: 0.01
      },
      sold_over_list_pct: {
        value_pct: 41,
        yoy_change: 4
      },
      new_listings: {
        value: 18,
        yoy_change: -0.03
      },
      homes_sold: {
        value: 44,
        yoy_change: 0.02
      }
    },
    series: {
      period_end: ["2025-11-30", "2025-12-31"],
      median_sale_price: [560000, 570000],
      median_list_price: [575000, 580000],
      avg_sale_to_list: [1.01, 1.015],
      sold_above_list: [0.39, 0.41],
      new_listings: [20, 18],
      homes_sold: [40, 44]
    },
    competitiveness: {
      score: 4,
      label: "Competitive",
      explanation: "Most homes are selling over list.",
      confidence_tier: "high"
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

test("format helpers handle nulls and signs", () => {
  assert.equal(formatCurrency(null), "No data");
  assert.equal(formatRatio(null), "No data");
  assert.equal(formatCount(null), "No data");
  assert.equal(formatSignedPercent(null), "No data");
  assert.equal(formatSignedPercentChange(null), "No data");

  assert.equal(formatCurrency(580000), "$580,000");
  assert.equal(formatRatio(1.015), "1.015");
  assert.equal(formatCount(12345), "12,345");
  assert.equal(formatSignedPercent(1.5), "+1.5%");
  assert.equal(formatSignedPercent(-2.3), "-2.3%");
  assert.equal(formatSignedPercentChange(0.05), "+5.0%");
  assert.equal(formatSignedPercentChange(-0.03), "-3.0%");
});

test("formatPeriodLabel returns month-year label for ISO dates", () => {
  assert.equal(formatPeriodLabel("2025-12-31"), "Dec 2025");
  assert.equal(formatPeriodLabel("not-a-date"), "not-a-date");
});

test("toSegmentLabel maps segment keys to user-facing labels", () => {
  assert.equal(toSegmentLabel("all"), "All homes");
  assert.equal(toSegmentLabel("single_family"), "Single-family");
  assert.equal(toSegmentLabel("condo_coop"), "Condo/co-op");
  assert.equal(toSegmentLabel("townhouse"), "Townhouse");
});

test("formatLocationHeading returns town plus ZIP when city is present", () => {
  assert.equal(formatLocationHeading("07960", "Morristown"), "Morristown (ZIP 07960)");
  assert.equal(formatLocationHeading("07960", "  "), "ZIP 07960");
  assert.equal(formatLocationHeading("07960", null), "ZIP 07960");
});

test("buildKpiCards returns formatted KPI values and deltas", () => {
  const cards = buildKpiCards(createPayload());

  assert.equal(cards.length, 6);
  assert.deepEqual(cards[0], {
    key: "median_list_price",
    label: "Median List Price",
    tooltip: METRIC_TOOLTIP_COPY.median_list_price,
    value: "$580,000",
    primaryDelta: "MoM +1.0%",
    secondaryDelta: "YoY +5.0%"
  });
  assert.deepEqual(cards[2], {
    key: "sale_to_list_ratio",
    label: "Sale-to-List Ratio",
    tooltip: METRIC_TOOLTIP_COPY.sale_to_list_ratio,
    value: "1.015",
    primaryDelta: "Over/under +1.5%",
    secondaryDelta: "YoY +1.0%"
  });
  assert.deepEqual(cards[3], {
    key: "sold_over_list_pct",
    label: "Sold Over List",
    tooltip: METRIC_TOOLTIP_COPY.sold_over_list_pct,
    value: "41.0%",
    primaryDelta: "YoY +4.0%",
    secondaryDelta: null
  });
});

test("buildChartRows returns aligned chart rows and percent conversion", () => {
  const rows = buildChartRows(createPayload());

  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    periodEnd: "2025-11-30",
    periodLabel: "Nov 2025",
    medianSalePrice: 560000,
    medianListPrice: 575000,
    saleToListRatio: 1.01,
    soldOverListPct: 39,
    newListings: 20,
    homesSold: 40
  });
  assert.equal(rows[1].soldOverListPct, 41);
});
