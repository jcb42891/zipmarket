import { createHash } from "node:crypto";

import type { ApiErrorCode, ApiErrorEnvelope } from "./contracts";

export const DEFAULT_CACHE_CONTROL_HEADER =
  "public, s-maxage=3600, stale-while-revalidate=86400";

function normalizeEtag(etag: string): string {
  return etag.trim().replace(/^W\//, "");
}

export function toEtag(payload: unknown, dataVersion: string): string {
  const hash = createHash("sha1")
    .update(dataVersion)
    .update(":")
    .update(JSON.stringify(payload))
    .digest("hex");

  return `"${hash}"`;
}

export function matchesIfNoneMatch(
  headerValue: string | null,
  etag: string
): boolean {
  if (!headerValue) {
    return false;
  }

  const normalizedTarget = normalizeEtag(etag);
  const candidates = headerValue.split(",").map((rawValue) => rawValue.trim());

  if (candidates.includes("*")) {
    return true;
  }

  return candidates.some((candidate) => normalizeEtag(candidate) === normalizedTarget);
}

export function jsonResponse(
  payload: unknown,
  status: number,
  options: {
    etag?: string;
    cacheControl?: string;
  } = {}
): Response {
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": options.cacheControl ?? DEFAULT_CACHE_CONTROL_HEADER
  });

  if (options.etag) {
    headers.set("etag", options.etag);
  }

  return new Response(JSON.stringify(payload), {
    status,
    headers
  });
}

export function notModifiedResponse(
  etag: string,
  cacheControl: string = DEFAULT_CACHE_CONTROL_HEADER
): Response {
  return new Response(null, {
    status: 304,
    headers: {
      etag,
      "cache-control": cacheControl
    }
  });
}

export function errorResponse(
  status: number,
  code: ApiErrorCode,
  message: string,
  details?: Record<string, unknown>
): Response {
  const payload: ApiErrorEnvelope = {
    error: {
      code,
      message,
      details
    }
  };

  return jsonResponse(payload, status);
}
