import { zipCodeSchema } from "@zipmarket/shared";
import { ZodError } from "zod";

import {
  buildSuggestionsCacheKey,
  createApiCache,
  DEFAULT_SUGGESTIONS_CACHE_TTL_SECONDS,
  type ApiCache
} from "./cache";
import { zipSuggestionsResponseSchema } from "./contracts";
import {
  fetchZipSuggestions,
  type ZipSuggestionsFetchResult
} from "./dashboard-service";
import {
  errorResponse,
  jsonResponse,
  matchesIfNoneMatch,
  notModifiedResponse,
  toEtag
} from "./http";

interface RouteContext {
  params: Promise<{
    zip: string;
  }>;
}

export interface ZipSuggestionsRouteDependencies {
  cache: ApiCache;
  fetchZipSuggestions: (zip: string) => Promise<ZipSuggestionsFetchResult>;
}

function getDefaultDependencies(): ZipSuggestionsRouteDependencies {
  return {
    cache: createApiCache(),
    fetchZipSuggestions
  };
}

async function fromCache(
  request: Request,
  dependencies: ZipSuggestionsRouteDependencies,
  cacheKey: string
): Promise<Response | null> {
  const cachedPayload = await dependencies.cache.get<unknown>(cacheKey);
  if (!cachedPayload) {
    return null;
  }

  const parsedCachedPayload = zipSuggestionsResponseSchema.safeParse(cachedPayload);
  if (!parsedCachedPayload.success) {
    return null;
  }

  const etag = toEtag(parsedCachedPayload.data, dependencies.cache.dataVersion);
  if (matchesIfNoneMatch(request.headers.get("if-none-match"), etag)) {
    return notModifiedResponse(etag);
  }

  return jsonResponse(parsedCachedPayload.data, 200, { etag });
}

export function createZipSuggestionsRoute(
  dependencies: ZipSuggestionsRouteDependencies = getDefaultDependencies()
) {
  return async function GET(request: Request, context: RouteContext): Promise<Response> {
    const params = await context.params;
    const zip = params.zip.trim();

    try {
      zipCodeSchema.parse(zip);
    } catch (error) {
      if (error instanceof ZodError) {
        return errorResponse(400, "INVALID_ZIP", "ZIP format must be exactly 5 digits.");
      }

      return errorResponse(500, "INTERNAL_ERROR", "Unable to process request.");
    }

    const cacheKey = buildSuggestionsCacheKey({
      zip,
      dataVersion: dependencies.cache.dataVersion
    });

    const cachedResponse = await fromCache(request, dependencies, cacheKey);
    if (cachedResponse) {
      return cachedResponse;
    }

    try {
      const result = await dependencies.fetchZipSuggestions(zip);

      if (result.type === "zip_not_found") {
        return errorResponse(404, "ZIP_NOT_FOUND", "ZIP was not found in metadata.");
      }

      if (result.type === "non_nj") {
        return errorResponse(400, "NON_NJ_ZIP", "ZIP code is outside New Jersey.");
      }

      const payload = zipSuggestionsResponseSchema.parse(result.payload);
      const etag = toEtag(payload, dependencies.cache.dataVersion);

      if (matchesIfNoneMatch(request.headers.get("if-none-match"), etag)) {
        return notModifiedResponse(etag);
      }

      await dependencies.cache.set(
        cacheKey,
        payload,
        DEFAULT_SUGGESTIONS_CACHE_TTL_SECONDS
      );

      return jsonResponse(payload, 200, { etag });
    } catch (error) {
      if (error instanceof ZodError) {
        return errorResponse(500, "INTERNAL_ERROR", "Response schema validation failed.", {
          issues: error.issues
        });
      }

      return errorResponse(500, "INTERNAL_ERROR", "Unable to load ZIP suggestions.");
    }
  };
}
