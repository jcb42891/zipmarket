import { ZodError } from "zod";

import {
  buildLocationResolveCacheKey,
  createApiCache,
  DEFAULT_LOCATION_RESOLVE_CACHE_TTL_SECONDS,
  type ApiCache
} from "./cache";
import {
  locationResolveQuerySchema,
  locationResolveResponseSchema
} from "./contracts";
import {
  fetchLocationResolution,
  type LocationResolveFetchResult
} from "./dashboard-service";
import {
  errorResponse,
  jsonResponse,
  matchesIfNoneMatch,
  notModifiedResponse,
  toEtag
} from "./http";

function normalizeCacheQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

export interface LocationResolveRouteDependencies {
  cache: ApiCache;
  fetchLocationResolution: (query: string) => Promise<LocationResolveFetchResult>;
}

function getDefaultDependencies(): LocationResolveRouteDependencies {
  return {
    cache: createApiCache(),
    fetchLocationResolution
  };
}

async function fromCache(
  request: Request,
  dependencies: LocationResolveRouteDependencies,
  cacheKey: string
): Promise<Response | null> {
  const cachedPayload = await dependencies.cache.get<unknown>(cacheKey);
  if (!cachedPayload) {
    return null;
  }

  const parsedCachedPayload = locationResolveResponseSchema.safeParse(cachedPayload);
  if (!parsedCachedPayload.success) {
    return null;
  }

  const etag = toEtag(parsedCachedPayload.data, dependencies.cache.dataVersion);
  if (matchesIfNoneMatch(request.headers.get("if-none-match"), etag)) {
    return notModifiedResponse(etag);
  }

  return jsonResponse(parsedCachedPayload.data, 200, { etag });
}

export function createLocationResolveRoute(
  dependencies: LocationResolveRouteDependencies = getDefaultDependencies()
) {
  return async function GET(request: Request): Promise<Response> {
    let query: string;

    try {
      const requestUrl = new URL(request.url);
      const parsed = locationResolveQuerySchema.parse({
        query: requestUrl.searchParams.get("query") ?? ""
      });
      query = parsed.query;
    } catch (error) {
      if (error instanceof ZodError) {
        return errorResponse(
          400,
          "INVALID_QUERY",
          "Query parameter \"query\" is required and must be a non-empty string."
        );
      }

      return errorResponse(500, "INTERNAL_ERROR", "Unable to process request.");
    }

    const cacheKey = buildLocationResolveCacheKey({
      query: normalizeCacheQuery(query),
      dataVersion: dependencies.cache.dataVersion
    });

    const cachedResponse = await fromCache(request, dependencies, cacheKey);
    if (cachedResponse) {
      return cachedResponse;
    }

    try {
      const result = await dependencies.fetchLocationResolution(query);

      if (result.type === "location_not_found") {
        return errorResponse(
          404,
          "LOCATION_NOT_FOUND",
          "Location could not be resolved to a New Jersey ZIP code."
        );
      }

      if (result.type === "non_nj") {
        return errorResponse(400, "NON_NJ_ZIP", "ZIP code is outside New Jersey.");
      }

      const payload = locationResolveResponseSchema.parse(result.payload);
      const etag = toEtag(payload, dependencies.cache.dataVersion);

      if (matchesIfNoneMatch(request.headers.get("if-none-match"), etag)) {
        return notModifiedResponse(etag);
      }

      await dependencies.cache.set(
        cacheKey,
        payload,
        DEFAULT_LOCATION_RESOLVE_CACHE_TTL_SECONDS
      );

      return jsonResponse(payload, 200, { etag });
    } catch (error) {
      if (error instanceof ZodError) {
        return errorResponse(500, "INTERNAL_ERROR", "Response schema validation failed.", {
          issues: error.issues
        });
      }

      return errorResponse(500, "INTERNAL_ERROR", "Unable to resolve location.");
    }
  };
}
