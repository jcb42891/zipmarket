import { zipCodeSchema } from "@zipmarket/shared";
import { ZodError } from "zod";

import {
  buildDashboardCacheKey,
  createApiCache,
  DEFAULT_DASHBOARD_CACHE_TTL_SECONDS,
  type ApiCache
} from "./cache";
import {
  dashboardQuerySchema,
  dashboardResponseSchema,
  type DashboardLookupInput
} from "./contracts";
import {
  fetchDashboard,
  type DashboardFetchResult
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

export interface DashboardRouteDependencies {
  cache: ApiCache;
  fetchDashboard: (input: DashboardLookupInput) => Promise<DashboardFetchResult>;
}

function getDefaultDependencies(): DashboardRouteDependencies {
  return {
    cache: createApiCache(),
    fetchDashboard
  };
}

function parseDashboardInput(request: Request, zipParam: string): DashboardLookupInput {
  const zip = zipCodeSchema.parse(zipParam.trim());
  const requestUrl = new URL(request.url);
  const query = dashboardQuerySchema.parse({
    segment: requestUrl.searchParams.get("segment") ?? undefined,
    months: requestUrl.searchParams.get("months") ?? undefined
  });

  return {
    zip,
    segment: query.segment,
    months: query.months
  };
}

async function fromCache(
  request: Request,
  dependencies: DashboardRouteDependencies,
  cacheKey: string
): Promise<Response | null> {
  const cachedPayload = await dependencies.cache.get<unknown>(cacheKey);
  if (!cachedPayload) {
    return null;
  }

  const parsedCachedPayload = dashboardResponseSchema.safeParse(cachedPayload);
  if (!parsedCachedPayload.success) {
    return null;
  }

  const etag = toEtag(parsedCachedPayload.data, dependencies.cache.dataVersion);
  if (matchesIfNoneMatch(request.headers.get("if-none-match"), etag)) {
    return notModifiedResponse(etag);
  }

  return jsonResponse(parsedCachedPayload.data, 200, { etag });
}

function mapLookupResultToResponse(result: DashboardFetchResult): {
  payload: unknown;
  status: number;
} {
  if (result.type === "zip_not_found") {
    return {
      payload: {
        error: {
          code: "ZIP_NOT_FOUND",
          message: "ZIP was not found in metadata."
        }
      },
      status: 404
    };
  }

  if (result.type === "non_nj") {
    return {
      payload: {
        error: {
          code: "NON_NJ_ZIP",
          message: "ZIP code is outside New Jersey."
        }
      },
      status: 400
    };
  }

  return {
    payload: result.payload,
    status: 200
  };
}

export function createDashboardRoute(
  dependencies: DashboardRouteDependencies = getDefaultDependencies()
) {
  return async function GET(request: Request, context: RouteContext): Promise<Response> {
    let dashboardInput: DashboardLookupInput;

    try {
      const params = await context.params;
      dashboardInput = parseDashboardInput(request, params.zip);
    } catch (error) {
      if (!(error instanceof ZodError)) {
        return errorResponse(500, "INTERNAL_ERROR", "Unable to process request.");
      }

      const issues = error.issues.map((issue) => issue.message);
      if (issues.some((message) => message.toLowerCase().includes("zip"))) {
        return errorResponse(400, "INVALID_ZIP", "ZIP format must be exactly 5 digits.");
      }

      return errorResponse(400, "INVALID_QUERY", "Invalid query parameters.", {
        issues
      });
    }

    const cacheKey = buildDashboardCacheKey({
      zip: dashboardInput.zip,
      segment: dashboardInput.segment,
      months: dashboardInput.months,
      dataVersion: dependencies.cache.dataVersion
    });

    const cachedResponse = await fromCache(request, dependencies, cacheKey);
    if (cachedResponse) {
      return cachedResponse;
    }

    try {
      const result = await dependencies.fetchDashboard(dashboardInput);
      const mappedResult = mapLookupResultToResponse(result);

      if (mappedResult.status !== 200) {
        const errorPayload = mappedResult.payload as {
          error: { code: "ZIP_NOT_FOUND" | "NON_NJ_ZIP"; message: string };
        };
        return errorResponse(
          mappedResult.status,
          errorPayload.error.code,
          errorPayload.error.message
        );
      }

      const parsedPayload = dashboardResponseSchema.parse(mappedResult.payload);
      const etag = toEtag(parsedPayload, dependencies.cache.dataVersion);

      if (matchesIfNoneMatch(request.headers.get("if-none-match"), etag)) {
        return notModifiedResponse(etag);
      }

      await dependencies.cache.set(
        cacheKey,
        parsedPayload,
        DEFAULT_DASHBOARD_CACHE_TTL_SECONDS
      );

      return jsonResponse(parsedPayload, 200, { etag });
    } catch (error) {
      if (error instanceof ZodError) {
        return errorResponse(500, "INTERNAL_ERROR", "Response schema validation failed.", {
          issues: error.issues
        });
      }

      return errorResponse(500, "INTERNAL_ERROR", "Unable to load dashboard data.");
    }
  };
}
