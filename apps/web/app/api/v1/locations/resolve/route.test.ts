import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLocationResolveCacheKey,
  type ApiCache
} from "../../../../../lib/api/cache";
import { type LocationResolveResponse } from "../../../../../lib/api/contracts";
import { createLocationResolveRoute } from "../../../../../lib/api/location-resolve-route";

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

test("location resolve route returns 400 for missing query parameter", async () => {
  const route = createLocationResolveRoute({
    cache: new MemoryCache(),
    fetchLocationResolution: async () => ({
      type: "location_not_found"
    })
  });

  const response = await route(new Request("https://example.com/api/v1/locations/resolve"));

  assert.equal(response.status, 400);
  const body = (await response.json()) as { error: { code: string } };
  assert.equal(body.error.code, "INVALID_QUERY");
});

test("location resolve route returns 200 with resolved town ZIP", async () => {
  const route = createLocationResolveRoute({
    cache: new MemoryCache(),
    fetchLocationResolution: async () => ({
      type: "resolved",
      payload: {
        query: "morristown",
        resolved_zip: "07960",
        match_type: "town",
        is_ambiguous: false,
        candidate_zips: ["07960"]
      }
    })
  });

  const response = await route(
    new Request("https://example.com/api/v1/locations/resolve?query=morristown")
  );

  assert.equal(response.status, 200);
  const body = (await response.json()) as LocationResolveResponse;
  assert.equal(body.resolved_zip, "07960");
  assert.equal(body.match_type, "town");
});

test("location resolve route returns 400 for non-NJ ZIP query", async () => {
  const route = createLocationResolveRoute({
    cache: new MemoryCache(),
    fetchLocationResolution: async () => ({
      type: "non_nj"
    })
  });

  const response = await route(
    new Request("https://example.com/api/v1/locations/resolve?query=10001")
  );

  assert.equal(response.status, 400);
  const body = (await response.json()) as { error: { code: string } };
  assert.equal(body.error.code, "NON_NJ_ZIP");
});

test("location resolve route returns 404 when town cannot be resolved", async () => {
  const route = createLocationResolveRoute({
    cache: new MemoryCache(),
    fetchLocationResolution: async () => ({
      type: "location_not_found"
    })
  });

  const response = await route(
    new Request("https://example.com/api/v1/locations/resolve?query=notatown")
  );

  assert.equal(response.status, 404);
  const body = (await response.json()) as { error: { code: string } };
  assert.equal(body.error.code, "LOCATION_NOT_FOUND");
});

test("location resolve route serves cached payload on repeated request", async () => {
  const cache = new MemoryCache("9");
  let fetchCount = 0;

  const route = createLocationResolveRoute({
    cache,
    fetchLocationResolution: async () => {
      fetchCount += 1;
      return {
        type: "resolved" as const,
        payload: {
          query: "Morristown",
          resolved_zip: "07960",
          match_type: "town" as const,
          is_ambiguous: false,
          candidate_zips: ["07960"]
        }
      };
    }
  });

  const requestUrl = "https://example.com/api/v1/locations/resolve?query=Morristown";
  const firstResponse = await route(new Request(requestUrl));
  assert.equal(firstResponse.status, 200);
  assert.equal(fetchCount, 1);

  const secondResponse = await route(new Request(requestUrl));
  assert.equal(secondResponse.status, 200);
  assert.equal(fetchCount, 1);

  const cacheKey = buildLocationResolveCacheKey({
    query: "morristown",
    dataVersion: "9"
  });
  assert.ok(cache.store.has(cacheKey));
});
