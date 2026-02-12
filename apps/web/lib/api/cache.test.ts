import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDashboardCacheKey,
  buildLocationResolveCacheKey,
  buildSuggestionsCacheKey,
  CACHE_NAMESPACE,
  createApiCache,
  DEFAULT_CACHE_DATA_VERSION
} from "./cache";

function testEnv(
  overrides: Record<string, string | undefined> = {}
): NodeJS.ProcessEnv {
  return {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV ?? "test",
    ...overrides
  };
}

test("buildDashboardCacheKey includes namespace, version, zip, segment, and months", () => {
  const cacheKey = buildDashboardCacheKey({
    zip: "07001",
    segment: "all",
    months: 24,
    dataVersion: "42"
  });

  assert.equal(
    cacheKey,
    `${CACHE_NAMESPACE}:dashboard:42:07001:all:24`
  );
});

test("buildSuggestionsCacheKey includes namespace and version", () => {
  const cacheKey = buildSuggestionsCacheKey({
    zip: "07001",
    dataVersion: "abc"
  });

  assert.equal(cacheKey, `${CACHE_NAMESPACE}:suggestions:abc:07001`);
});

test("buildLocationResolveCacheKey includes namespace and normalized query", () => {
  const cacheKey = buildLocationResolveCacheKey({
    query: "morristown",
    dataVersion: "abc"
  });

  assert.equal(cacheKey, `${CACHE_NAMESPACE}:location-resolve:abc:morristown`);
});

test("createApiCache falls back to no-op cache without Redis credentials", async () => {
  const cache = createApiCache(
    testEnv({
      CACHE_DATA_VERSION: "v5",
      REDIS_URL: undefined,
      REDIS_TOKEN: undefined
    })
  );

  assert.equal(cache.dataVersion, "v5");
  assert.equal(await cache.get("missing"), null);
  await cache.set("demo", { value: 1 }, 300);
});

test("createApiCache uses default data version when CACHE_DATA_VERSION is missing", () => {
  const cache = createApiCache(
    testEnv({
      CACHE_DATA_VERSION: undefined,
      REDIS_URL: undefined,
      REDIS_TOKEN: undefined
    })
  );
  assert.equal(cache.dataVersion, DEFAULT_CACHE_DATA_VERSION);
});

test("createApiCache issues Upstash REST commands for set/get", async () => {
  const commands: unknown[] = [];

  const fetchStub: typeof fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
    commands.push(JSON.parse(String(init?.body)));
    const command = commands.at(-1) as unknown[];
    const commandName = String(command[0] ?? "");

    if (commandName === "GET") {
      return new Response(JSON.stringify({ result: "{\"zip\":\"07001\"}" }), {
        status: 200
      });
    }

    return new Response(JSON.stringify({ result: "OK" }), {
      status: 200
    });
  };

  const cache = createApiCache(
    testEnv({
      REDIS_URL: "https://example-redis.upstash.io",
      REDIS_TOKEN: "secret",
      CACHE_DATA_VERSION: "2"
    }),
    fetchStub
  );

  await cache.set("cache:key", { zip: "07001" }, 60);
  const cached = await cache.get<{ zip: string }>("cache:key");

  assert.deepEqual(cached, { zip: "07001" });
  assert.deepEqual(commands, [
    ["SET", "cache:key", "{\"zip\":\"07001\"}", "EX", 60],
    ["GET", "cache:key"]
  ]);
});
