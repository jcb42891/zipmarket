import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchDashboardState,
  mapDashboardResponse,
  resolveInitialDashboardState
} from "./dashboard-client";

test("resolveInitialDashboardState returns invalid_zip for malformed route param", () => {
  const state = resolveInitialDashboardState("7001");

  assert.equal(state.kind, "invalid_zip");
  assert.equal(state.message, "ZIP format must be exactly 5 digits.");
});

test("resolveInitialDashboardState returns loading for valid route param", () => {
  const state = resolveInitialDashboardState("07001");

  assert.deepEqual(state, {
    kind: "loading",
    zip: "07001"
  });
});

test("mapDashboardResponse maps supported payload", () => {
  const state = mapDashboardResponse("07001", 200, {
    zip: "07001",
    status: "supported",
    segment: "all",
    latest_period_end: "2025-12-31",
    kpis: {
      median_list_price: { value: 580000, yoy_change: 0.05, mom_change: 0.01 },
      median_sale_price: { value: 570000, yoy_change: 0.06, mom_change: 0.02 },
      sale_to_list_ratio: { value: 1.015, over_under_pct: 1.5, yoy_change: 0.01 },
      sold_over_list_pct: { value_pct: 41, yoy_change: 4 },
      new_listings: { value: 18, yoy_change: -0.03 },
      homes_sold: { value: 44, yoy_change: 0.02 }
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
  });

  assert.equal(state.kind, "supported");
});

test("mapDashboardResponse maps unsupported payload", () => {
  const state = mapDashboardResponse("07001", 200, {
    zip: "07001",
    status: "unsupported",
    message: "Data not available yet",
    nearby_supported_zips: [
      { zip: "07002", distance_miles: 1.2 },
      { zip: "07003", distance_miles: 2.7 }
    ]
  });

  assert.equal(state.kind, "unsupported");
  if (state.kind === "unsupported") {
    assert.equal(state.payload.nearby_supported_zips.length, 2);
  }
});

test("mapDashboardResponse maps NON_NJ_ZIP envelope into non_nj state", () => {
  const state = mapDashboardResponse("10001", 400, {
    error: {
      code: "NON_NJ_ZIP",
      message: "ZIP code is outside New Jersey."
    }
  });

  assert.deepEqual(state, {
    kind: "non_nj",
    zip: "10001",
    message: "ZIP code is outside New Jersey."
  });
});

test("mapDashboardResponse falls back to internal_error when payload is not parseable", () => {
  const state = mapDashboardResponse("07001", 200, {
    foo: "bar"
  });

  assert.deepEqual(state, {
    kind: "internal_error",
    zip: "07001",
    message: "Unable to load dashboard data. Please try again."
  });
});

test("fetchDashboardState maps response payload for smoke transition coverage", async () => {
  const state = await fetchDashboardState(
    "07001",
    {
      segment: "single_family",
      months: 24,
      fetchFn: async (input) => {
        assert.equal(input, "/api/v1/dashboard/07001?segment=single_family&months=24");
        return new Response(
          JSON.stringify({
            zip: "07001",
            status: "unsupported",
            message: "Data not available yet",
            nearby_supported_zips: [{ zip: "07002", distance_miles: 1.3 }]
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        );
      }
    }
  );

  assert.equal(state.kind, "unsupported");
});

test("fetchDashboardState handles network failures with internal_error state", async () => {
  const state = await fetchDashboardState("07001", {
    fetchFn: async () => {
      throw new Error("network down");
    }
  });

  assert.deepEqual(state, {
    kind: "internal_error",
    zip: "07001",
    message: "Unable to load dashboard data. Please try again."
  });
});

test("fetchDashboardState defaults to all-segment request when options are omitted", async () => {
  let requestedPath = "";
  await fetchDashboardState("07001", {
    fetchFn: async (input) => {
      requestedPath = String(input);
      return new Response(
        JSON.stringify({
          error: {
            code: "ZIP_NOT_FOUND",
            message: "ZIP was not found in metadata."
          }
        }),
        { status: 404, headers: { "content-type": "application/json" } }
      );
    }
  });

  assert.equal(requestedPath, "/api/v1/dashboard/07001");
});
