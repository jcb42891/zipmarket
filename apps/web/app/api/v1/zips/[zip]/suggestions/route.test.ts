import assert from "node:assert/strict";
import test from "node:test";

import type { ApiCache } from "../../../../../../lib/api/cache";
import { type ZipSuggestionsResponse } from "../../../../../../lib/api/contracts";
import { createZipSuggestionsRoute } from "../../../../../../lib/api/zip-suggestions-route";

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

test("zip suggestions route returns 400 for invalid ZIP format", async () => {
  const route = createZipSuggestionsRoute({
    cache: new MemoryCache(),
    fetchZipSuggestions: async () => ({
      type: "zip_not_found"
    })
  });

  const response = await route(
    new Request("https://example.com/api/v1/zips/7001/suggestions"),
    { params: Promise.resolve({ zip: "7001" }) }
  );

  assert.equal(response.status, 400);
  const body = (await response.json()) as { error: { code: string } };
  assert.equal(body.error.code, "INVALID_ZIP");
});

test("zip suggestions route returns 200 with nearest supported ZIPs", async () => {
  const route = createZipSuggestionsRoute({
    cache: new MemoryCache(),
    fetchZipSuggestions: async () => ({
      type: "ok",
      payload: {
        zip: "07001",
        suggestions: [
          { zip: "07002", distance_miles: 1.2 },
          { zip: "07003", distance_miles: 2.8 }
        ]
      }
    })
  });

  const response = await route(
    new Request("https://example.com/api/v1/zips/07001/suggestions"),
    { params: Promise.resolve({ zip: "07001" }) }
  );

  assert.equal(response.status, 200);
  const body = (await response.json()) as ZipSuggestionsResponse;
  assert.equal(body.suggestions.length, 2);
});

test("zip suggestions route returns 400 for non-NJ ZIP", async () => {
  const route = createZipSuggestionsRoute({
    cache: new MemoryCache(),
    fetchZipSuggestions: async () => ({
      type: "non_nj"
    })
  });

  const response = await route(
    new Request("https://example.com/api/v1/zips/10001/suggestions"),
    { params: Promise.resolve({ zip: "10001" }) }
  );

  assert.equal(response.status, 400);
  const body = (await response.json()) as { error: { code: string } };
  assert.equal(body.error.code, "NON_NJ_ZIP");
});

test("zip suggestions route returns 404 when ZIP is missing from metadata", async () => {
  const route = createZipSuggestionsRoute({
    cache: new MemoryCache(),
    fetchZipSuggestions: async () => ({
      type: "zip_not_found"
    })
  });

  const response = await route(
    new Request("https://example.com/api/v1/zips/07001/suggestions"),
    { params: Promise.resolve({ zip: "07001" }) }
  );

  assert.equal(response.status, 404);
  const body = (await response.json()) as { error: { code: string } };
  assert.equal(body.error.code, "ZIP_NOT_FOUND");
});
