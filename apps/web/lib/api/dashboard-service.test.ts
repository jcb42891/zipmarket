import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchDashboardWithExecutor,
  fetchLocationResolutionWithExecutor,
  fetchZipSuggestionsWithExecutor,
  type QueryResult,
  type SqlExecutor
} from "./dashboard-service";

interface QueryCall {
  text: string;
  params?: readonly unknown[];
}

class FakeExecutor implements SqlExecutor {
  public readonly calls: QueryCall[] = [];

  public constructor(
    private readonly handlers: {
      zipRows?: Array<{
        zip_code: string;
        state_code: string;
        city?: string | null;
        is_nj: boolean;
        is_supported: boolean;
      }>;
      townRows?: Array<{ zip_code: string; is_supported: boolean }>;
      latestRows?: Array<Record<string, unknown>>;
      seriesRows?: Array<Record<string, unknown>>;
      nearestRows?: Array<{ zip_code: string; distance_miles: number | string }>;
    } = {}
  ) {}

  public async query<Row = unknown>(
    text: string,
    params?: readonly unknown[]
  ): Promise<QueryResult<Row>> {
    this.calls.push({ text, params });

    if (text.includes("FROM dim_zip")) {
      if (text.includes("REGEXP_REPLACE(LOWER(BTRIM(city))")) {
        return {
          rows: (this.handlers.townRows ?? []) as Row[],
          rowCount: this.handlers.townRows?.length ?? 0
        };
      }

      return {
        rows: (this.handlers.zipRows ?? []) as Row[],
        rowCount: this.handlers.zipRows?.length ?? 0
      };
    }

    if (text.includes("FROM mart_zip_dashboard_latest")) {
      return {
        rows: (this.handlers.latestRows ?? []) as Row[],
        rowCount: this.handlers.latestRows?.length ?? 0
      };
    }

    if (text.includes("FROM mart_zip_dashboard_series")) {
      return {
        rows: (this.handlers.seriesRows ?? []) as Row[],
        rowCount: this.handlers.seriesRows?.length ?? 0
      };
    }

    if (text.includes("find_nearest_supported_zips")) {
      return {
        rows: (this.handlers.nearestRows ?? []) as Row[],
        rowCount: this.handlers.nearestRows?.length ?? 0
      };
    }

    return { rows: [], rowCount: 0 };
  }
}

test("fetchDashboardWithExecutor returns supported payload with aligned series arrays", async () => {
  const executor = new FakeExecutor({
    zipRows: [
      { zip_code: "07001", state_code: "NJ", city: "Avenel", is_nj: true, is_supported: true }
    ],
    latestRows: [
      {
        period_end: "2025-12-31",
        median_sale_price: "575000",
        median_list_price: "590000",
        homes_sold: "44",
        new_listings: "18",
        avg_sale_to_list: "1.015",
        sold_above_list: "0.41",
        median_sale_price_yoy: "0.06",
        median_list_price_yoy: "0.05",
        homes_sold_yoy: "0.02",
        new_listings_yoy: "-0.03",
        avg_sale_to_list_yoy: "0.01",
        sold_above_list_yoy: "0.04",
        sale_to_list_pct_over_under: "1.5",
        competitiveness_score: 4,
        competitiveness_label: "Competitive",
        competitiveness_explanation: "Most homes are selling over list.",
        confidence_tier: "high",
        source_last_updated: "2026-01-10T10:00:00.000Z"
      }
    ],
    seriesRows: [
      {
        period_end: "2025-12-31",
        median_sale_price: "575000",
        median_list_price: "590000",
        homes_sold: "44",
        new_listings: "18",
        avg_sale_to_list: "1.015",
        sold_above_list: "0.41",
        median_sale_price_mom: "0.01",
        median_list_price_mom: "0.02"
      },
      {
        period_end: "2025-11-30",
        median_sale_price: "560000",
        median_list_price: "580000",
        homes_sold: "40",
        new_listings: "20",
        avg_sale_to_list: "1.01",
        sold_above_list: "0.39",
        median_sale_price_mom: "0.00",
        median_list_price_mom: "0.01"
      }
    ]
  });

  const result = await fetchDashboardWithExecutor(executor, {
    zip: "07001",
    segment: "all",
    months: 36
  });

  assert.equal(result.type, "supported");
  if (result.type !== "supported") {
    return;
  }

  assert.equal(result.payload.status, "supported");
  assert.equal(result.payload.city, "Avenel");
  assert.equal(result.payload.kpis.sale_to_list_ratio.over_under_pct, 1.5);
  assert.equal(result.payload.kpis.sold_over_list_pct.value_pct, 41);
  assert.deepEqual(result.payload.series.period_end, ["2025-11-30", "2025-12-31"]);
  assert.equal(result.payload.methodology.source, "Redfin Data Center");
  assert.ok(
    executor.calls.some((call) => call.text.includes("FROM mart_zip_dashboard_latest"))
  );
  assert.ok(
    executor.calls.some((call) => call.text.includes("FROM mart_zip_dashboard_series"))
  );
});

test("fetchDashboardWithExecutor returns unsupported payload with nearby ZIP suggestions", async () => {
  const executor = new FakeExecutor({
    zipRows: [
      { zip_code: "07001", state_code: "NJ", city: "Avenel", is_nj: true, is_supported: false }
    ],
    nearestRows: [
      { zip_code: "07002", distance_miles: "1.1" },
      { zip_code: "07003", distance_miles: 2.4 }
    ]
  });

  const result = await fetchDashboardWithExecutor(executor, {
    zip: "07001",
    segment: "all",
    months: 24
  });

  assert.equal(result.type, "unsupported");
  if (result.type !== "unsupported") {
    return;
  }

  assert.equal(result.payload.city, "Avenel");
  assert.equal(result.payload.message, "Data not available yet");
  assert.deepEqual(result.payload.nearby_supported_zips, [
    { zip: "07002", distance_miles: 1.1 },
    { zip: "07003", distance_miles: 2.4 }
  ]);
});

test("fetchDashboardWithExecutor returns non_nj for non-NJ ZIPs", async () => {
  const executor = new FakeExecutor({
    zipRows: [{ zip_code: "10001", state_code: "NY", is_nj: false, is_supported: false }]
  });

  const result = await fetchDashboardWithExecutor(executor, {
    zip: "10001",
    segment: "all",
    months: 36
  });

  assert.deepEqual(result, { type: "non_nj" });
});

test("fetchDashboardWithExecutor returns zip_not_found when metadata does not contain ZIP", async () => {
  const executor = new FakeExecutor({
    zipRows: []
  });

  const result = await fetchDashboardWithExecutor(executor, {
    zip: "07001",
    segment: "all",
    months: 36
  });

  assert.deepEqual(result, { type: "zip_not_found" });
});

test("fetchZipSuggestionsWithExecutor returns nearest supported ZIPs for NJ ZIPs", async () => {
  const executor = new FakeExecutor({
    zipRows: [{ zip_code: "07001", state_code: "NJ", is_nj: true, is_supported: false }],
    nearestRows: [
      { zip_code: "07002", distance_miles: 1.25 },
      { zip_code: "07003", distance_miles: "2.75" }
    ]
  });

  const result = await fetchZipSuggestionsWithExecutor(executor, "07001");

  assert.equal(result.type, "ok");
  if (result.type !== "ok") {
    return;
  }

  assert.deepEqual(result.payload.suggestions, [
    { zip: "07002", distance_miles: 1.25 },
    { zip: "07003", distance_miles: 2.75 }
  ]);
});

test("fetchZipSuggestionsWithExecutor returns non_nj for non-NJ ZIPs", async () => {
  const executor = new FakeExecutor({
    zipRows: [{ zip_code: "10001", state_code: "NY", is_nj: false, is_supported: false }]
  });

  const result = await fetchZipSuggestionsWithExecutor(executor, "10001");
  assert.deepEqual(result, { type: "non_nj" });
});

test("fetchZipSuggestionsWithExecutor returns zip_not_found when ZIP is unknown", async () => {
  const executor = new FakeExecutor({
    zipRows: []
  });

  const result = await fetchZipSuggestionsWithExecutor(executor, "07001");
  assert.deepEqual(result, { type: "zip_not_found" });
});

test("fetchLocationResolutionWithExecutor resolves NJ ZIP input directly", async () => {
  const executor = new FakeExecutor({
    zipRows: [{ zip_code: "07001", state_code: "NJ", is_nj: true, is_supported: true }]
  });

  const result = await fetchLocationResolutionWithExecutor(executor, "07001");

  assert.equal(result.type, "resolved");
  if (result.type !== "resolved") {
    return;
  }

  assert.deepEqual(result.payload, {
    query: "07001",
    resolved_zip: "07001",
    match_type: "zip",
    is_ambiguous: false,
    candidate_zips: ["07001"]
  });
});

test("fetchLocationResolutionWithExecutor resolves town input with sorted candidates", async () => {
  const executor = new FakeExecutor({
    townRows: [
      { zip_code: "07960", is_supported: true },
      { zip_code: "07961", is_supported: false }
    ]
  });

  const result = await fetchLocationResolutionWithExecutor(executor, "Morristown");

  assert.equal(result.type, "resolved");
  if (result.type !== "resolved") {
    return;
  }

  assert.equal(result.payload.resolved_zip, "07960");
  assert.equal(result.payload.match_type, "town");
  assert.equal(result.payload.is_ambiguous, true);
  assert.deepEqual(result.payload.candidate_zips, ["07960", "07961"]);
});

test("fetchLocationResolutionWithExecutor normalizes town query suffixes", async () => {
  const executor = new FakeExecutor({
    townRows: [{ zip_code: "07960", is_supported: true }]
  });

  const result = await fetchLocationResolutionWithExecutor(executor, "Morristown, NJ");

  assert.equal(result.type, "resolved");
  const townLookupCall = executor.calls.find((call) =>
    call.text.includes("REGEXP_REPLACE(LOWER(BTRIM(city))")
  );
  assert.equal(townLookupCall?.params?.[0], "morristown");
});

test("fetchLocationResolutionWithExecutor returns non_nj for non-NJ ZIP input", async () => {
  const executor = new FakeExecutor({
    zipRows: [{ zip_code: "10001", state_code: "NY", is_nj: false, is_supported: false }]
  });

  const result = await fetchLocationResolutionWithExecutor(executor, "10001");
  assert.deepEqual(result, { type: "non_nj" });
});

test("fetchLocationResolutionWithExecutor returns location_not_found for unknown town", async () => {
  const executor = new FakeExecutor({
    townRows: []
  });

  const result = await fetchLocationResolutionWithExecutor(executor, "notatown");
  assert.deepEqual(result, { type: "location_not_found" });
});
