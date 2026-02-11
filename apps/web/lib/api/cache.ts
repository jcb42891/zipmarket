import type { DashboardSegment } from "@zipmarket/shared";

export const CACHE_NAMESPACE = "zipmarket:m4";
export const DEFAULT_CACHE_DATA_VERSION = "1";
export const DEFAULT_DASHBOARD_CACHE_TTL_SECONDS = 3600;
export const DEFAULT_SUGGESTIONS_CACHE_TTL_SECONDS = 3600;

interface UpstashCommandResponse<T> {
  result?: T;
  error?: string;
}

interface CacheRuntimeConfig {
  dataVersion: string;
  redisUrl?: string;
  redisToken?: string;
}

export interface ApiCache {
  dataVersion: string;
  get<T = unknown>(cacheKey: string): Promise<T | null>;
  set(cacheKey: string, value: unknown, ttlSeconds: number): Promise<void>;
}

function resolveCacheRuntimeConfig(env: NodeJS.ProcessEnv): CacheRuntimeConfig {
  const dataVersion = env.CACHE_DATA_VERSION?.trim() || DEFAULT_CACHE_DATA_VERSION;
  const redisUrl = env.REDIS_URL?.trim() || undefined;
  const redisToken = env.REDIS_TOKEN?.trim() || undefined;

  return {
    dataVersion,
    redisUrl,
    redisToken
  };
}

function normalizeTtlSeconds(ttlSeconds: number): number {
  if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
    throw new Error(`Expected ttlSeconds to be a positive integer, received ${ttlSeconds}.`);
  }

  return ttlSeconds;
}

export function buildDashboardCacheKey(input: {
  zip: string;
  segment: DashboardSegment;
  months: number;
  dataVersion: string;
}): string {
  return `${CACHE_NAMESPACE}:dashboard:${input.dataVersion}:${input.zip}:${input.segment}:${input.months}`;
}

export function buildSuggestionsCacheKey(input: {
  zip: string;
  dataVersion: string;
}): string {
  return `${CACHE_NAMESPACE}:suggestions:${input.dataVersion}:${input.zip}`;
}

class NoopApiCache implements ApiCache {
  public constructor(public readonly dataVersion: string) {}

  public async get<T = unknown>(): Promise<T | null> {
    return null;
  }

  public async set(): Promise<void> {
    return;
  }
}

class UpstashRestApiCache implements ApiCache {
  public constructor(
    public readonly dataVersion: string,
    private readonly redisUrl: string,
    private readonly redisToken: string,
    private readonly fetchImpl: typeof fetch
  ) {}

  private async executeCommand<T>(command: readonly unknown[]): Promise<T | undefined> {
    const response = await this.fetchImpl(this.redisUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.redisToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(command),
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Redis command failed with HTTP ${response.status}.`);
    }

    const payload = (await response.json()) as UpstashCommandResponse<T>;
    if (payload.error) {
      throw new Error(`Redis command failed: ${payload.error}`);
    }

    return payload.result;
  }

  public async get<T = unknown>(cacheKey: string): Promise<T | null> {
    try {
      const rawPayload = await this.executeCommand<string | null>(["GET", cacheKey]);
      if (!rawPayload) {
        return null;
      }

      return JSON.parse(rawPayload) as T;
    } catch {
      return null;
    }
  }

  public async set(cacheKey: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      const normalizedTtlSeconds = normalizeTtlSeconds(ttlSeconds);
      await this.executeCommand(["SET", cacheKey, JSON.stringify(value), "EX", normalizedTtlSeconds]);
    } catch {
      // Cache write failures should not block API responses.
    }
  }
}

export function createApiCache(
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch
): ApiCache {
  const config = resolveCacheRuntimeConfig(env);

  if (!config.redisUrl || !config.redisToken) {
    return new NoopApiCache(config.dataVersion);
  }

  return new UpstashRestApiCache(
    config.dataVersion,
    config.redisUrl,
    config.redisToken,
    fetchImpl
  );
}
