import assert from "node:assert/strict";
import test from "node:test";

import type { DashboardSegment } from "@zipmarket/shared";

import {
  buildDashboardCacheKey,
  type ApiCache
} from "../../../../../lib/api/cache";
import {
  DASHBOARD_DISCLAIMER,
  type DashboardSupportedResponse,
  type DashboardResponse
} from "../../../../../lib/api/contracts";
import { createDashboardRoute } from "../../../../../lib/api/dashboard-route";

class MemoryCache implements ApiCache {
  public readonly store = new Map<string, unknown>();

  public constructor(public readonly dataVersion: string = "1") {}

  public async get<T = unknown>(cacheKey: string): Promise<T | null> {
    if (!this.store.has(cacheKey)) {
      return null;
    }

    return this.store.get(cacheKey) as T;
  }

  public async set(cacheKey: string, value: unknown): Promise<void> {
    this.store.set(cacheKey, value);
  }
}

function createSupportedPayload(
  zip: string = "07001",
  segment: DashboardSegment = "all"
): DashboardSupportedResponse {
  return {
    zip,
    status: "supported",
    segment,
    latest_period_end: "2025-12-31",
    kpis: {
      median_list_price: {
        value: 580000,
        yoy_change: 0.05,
        mom_change: 0.01
      },
      median_sale_price: {
        value: 570000,
        yoy_change: 0.06,
        mom_change: 0.02
      },
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
    disclaimer: DASHBOARD_DISCLAIMER,
    methodology: {
      source: "Redfin Data Center",
      last_updated: "2026-01-10T10:00:00.000Z",
      window_type: "rolling_monthly_aggregates"
    }
  };
}

test("dashboard route returns 400 for invalid ZIP format", async () => {
  const cache = new MemoryCache();
  const route = createDashboardRoute({
    cache,
    fetchDashboard: async () => ({
      type: "zip_not_found"
    })
  });

  const response = await route(
    new Request("https://example.com/api/v1/dashboard/7001"),
    { params: Promise.resolve({ zip: "7001" }) }
  );

  assert.equal(response.status, 400);
  const body = (await response.json()) as { error: { code: string } };
  assert.equal(body.error.code, "INVALID_ZIP");
});

test("dashboard route returns supported response for valid supported ZIP", async () => {
  const cache = new MemoryCache();
  const payload = createSupportedPayload();
  const route = createDashboardRoute({
    cache,
    fetchDashboard: async () => ({
      type: "supported",
      payload
    })
  });

  const response = await route(
    new Request("https://example.com/api/v1/dashboard/07001?segment=all&months=24"),
    { params: Promise.resolve({ zip: "07001" }) }
  );

  assert.equal(response.status, 200);
  assert.ok(response.headers.get("etag"));
  assert.equal(
    response.headers.get("cache-control"),
    "public, s-maxage=3600, stale-while-revalidate=86400"
  );
  const body = (await response.json()) as DashboardResponse;
  assert.equal(body.status, "supported");
});

test("dashboard route returns unsupported response for unsupported NJ ZIP", async () => {
  const cache = new MemoryCache();
  const route = createDashboardRoute({
    cache,
    fetchDashboard: async () => ({
      type: "unsupported",
      payload: {
        zip: "07001",
        status: "unsupported",
        message: "Data not available yet",
        nearby_supported_zips: [
          { zip: "07002", distance_miles: 1.2 },
          { zip: "07003", distance_miles: 2.7 }
        ]
      }
    })
  });

  const response = await route(
    new Request("https://example.com/api/v1/dashboard/07001"),
    { params: Promise.resolve({ zip: "07001" }) }
  );

  assert.equal(response.status, 200);
  const body = (await response.json()) as DashboardResponse;
  assert.equal(body.status, "unsupported");
  if (body.status === "unsupported") {
    assert.equal(body.nearby_supported_zips.length, 2);
  }
});

test("dashboard route returns 400 for non-NJ ZIP", async () => {
  const cache = new MemoryCache();
  const route = createDashboardRoute({
    cache,
    fetchDashboard: async () => ({
      type: "non_nj"
    })
  });

  const response = await route(
    new Request("https://example.com/api/v1/dashboard/10001"),
    { params: Promise.resolve({ zip: "10001" }) }
  );

  assert.equal(response.status, 400);
  const body = (await response.json()) as { error: { code: string } };
  assert.equal(body.error.code, "NON_NJ_ZIP");
});

test("dashboard route serves cached payload on repeated request", async () => {
  const cache = new MemoryCache("3");
  const payload = createSupportedPayload();
  let fetchCount = 0;

  const route = createDashboardRoute({
    cache,
    fetchDashboard: async () => {
      fetchCount += 1;
      return {
        type: "supported",
        payload
      };
    }
  });

  const requestUrl = "https://example.com/api/v1/dashboard/07001?segment=all&months=24";
  const context = { params: Promise.resolve({ zip: "07001" }) };

  const firstResponse = await route(new Request(requestUrl), context);
  assert.equal(firstResponse.status, 200);
  assert.equal(fetchCount, 1);

  const secondResponse = await route(new Request(requestUrl), context);
  assert.equal(secondResponse.status, 200);
  assert.equal(fetchCount, 1);

  const cacheKey = buildDashboardCacheKey({
    zip: "07001",
    segment: "all",
    months: 24,
    dataVersion: "3"
  });
  assert.ok(cache.store.has(cacheKey));
});
