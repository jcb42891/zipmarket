import { ZIP_CODE_REGEX } from "@zipmarket/shared";
import {
  apiErrorEnvelopeSchema,
  locationResolveResponseSchema
} from "../api/contracts";

export const LOCATION_VALIDATION_MESSAGE = "Enter an NJ ZIP code or town name.";
export const LOCATION_RESOLVE_FALLBACK_MESSAGE =
  "Unable to resolve location. Please try again.";

export type LocationSubmission =
  | { ok: true; kind: "zip"; zip: string }
  | { ok: true; kind: "town"; query: string }
  | { ok: false; query: string; error: string };

export type LocationResolveResult =
  | { ok: true; zip: string }
  | { ok: false; error: string };

export function normalizeLocationInput(rawInput: string): string {
  return rawInput.replace(/\s+/g, " ").trim();
}

function normalizeZipCandidate(rawInput: string): string | null {
  const normalizedInput = normalizeLocationInput(rawInput);
  if (!/^[\d\s-]+$/.test(normalizedInput)) {
    return null;
  }

  const digitsOnly = normalizedInput.replace(/[^\d]/g, "");
  if (!ZIP_CODE_REGEX.test(digitsOnly)) {
    return null;
  }

  return digitsOnly;
}

export function validateLocationSubmission(rawInput: string): LocationSubmission {
  const normalized = normalizeLocationInput(rawInput);
  if (!normalized) {
    return {
      ok: false,
      query: normalized,
      error: LOCATION_VALIDATION_MESSAGE
    };
  }

  const zipCandidate = normalizeZipCandidate(normalized);
  if (zipCandidate) {
    return {
      ok: true,
      kind: "zip",
      zip: zipCandidate
    };
  }

  return {
    ok: true,
    kind: "town",
    query: normalized
  };
}

export function buildZipPath(zip: string): string {
  return `/zip/${zip}`;
}

interface ResolveLocationOptions {
  fetchFn?: typeof fetch;
}

export async function resolveLocationToZip(
  query: string,
  options: ResolveLocationOptions = {}
): Promise<LocationResolveResult> {
  const normalizedQuery = normalizeLocationInput(query);
  if (!normalizedQuery) {
    return {
      ok: false,
      error: LOCATION_VALIDATION_MESSAGE
    };
  }

  const fetchFn = options.fetchFn ?? fetch;
  const requestPath = `/api/v1/locations/resolve?${new URLSearchParams({
    query: normalizedQuery
  }).toString()}`;

  try {
    const response = await fetchFn(requestPath, {
      headers: {
        accept: "application/json"
      },
      cache: "no-store"
    });

    const payload = await response
      .json()
      .catch(() => ({ error: { code: "INTERNAL_ERROR", message: LOCATION_RESOLVE_FALLBACK_MESSAGE } }));

    if (response.status === 200) {
      const parsed = locationResolveResponseSchema.safeParse(payload);
      if (parsed.success) {
        return {
          ok: true,
          zip: parsed.data.resolved_zip
        };
      }
    }

    const parsedError = apiErrorEnvelopeSchema.safeParse(payload);
    if (parsedError.success) {
      return {
        ok: false,
        error: parsedError.data.error.message
      };
    }

    return {
      ok: false,
      error: LOCATION_RESOLVE_FALLBACK_MESSAGE
    };
  } catch {
    return {
      ok: false,
      error: LOCATION_RESOLVE_FALLBACK_MESSAGE
    };
  }
}
