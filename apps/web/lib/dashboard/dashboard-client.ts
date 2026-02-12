import { type DashboardSegment, ZIP_CODE_REGEX } from "@zipmarket/shared";

import {
  apiErrorEnvelopeSchema,
  dashboardSupportedResponseSchema,
  dashboardUnsupportedResponseSchema,
  type DashboardSupportedResponse,
  type DashboardUnsupportedResponse
} from "../api/contracts";

export type DashboardPageState =
  | { kind: "loading"; zip: string }
  | { kind: "supported"; zip: string; payload: DashboardSupportedResponse }
  | { kind: "unsupported"; zip: string; payload: DashboardUnsupportedResponse }
  | { kind: "invalid_zip"; zip: string; message: string }
  | { kind: "non_nj"; zip: string; message: string }
  | { kind: "zip_not_found"; zip: string; message: string }
  | { kind: "internal_error"; zip: string; message: string };

const FALLBACK_INTERNAL_ERROR = "Unable to load dashboard data. Please try again.";
const FALLBACK_INVALID_ZIP = "ZIP format must be exactly 5 digits.";

interface FetchDashboardStateOptions {
  segment?: DashboardSegment;
  months?: number;
  fetchFn?: typeof fetch;
}

function mapApiErrorCode(zip: string, code: string, message: string): DashboardPageState {
  if (code === "INVALID_ZIP") {
    return { kind: "invalid_zip", zip, message };
  }

  if (code === "NON_NJ_ZIP") {
    return { kind: "non_nj", zip, message };
  }

  if (code === "ZIP_NOT_FOUND") {
    return { kind: "zip_not_found", zip, message };
  }

  return { kind: "internal_error", zip, message };
}

export function resolveInitialDashboardState(zipParam: string): DashboardPageState {
  const zip = zipParam.trim();

  if (!ZIP_CODE_REGEX.test(zip)) {
    return {
      kind: "invalid_zip",
      zip,
      message: FALLBACK_INVALID_ZIP
    };
  }

  return {
    kind: "loading",
    zip
  };
}

export function mapDashboardResponse(
  zip: string,
  status: number,
  payload: unknown
): DashboardPageState {
  if (status === 200) {
    const supported = dashboardSupportedResponseSchema.safeParse(payload);
    if (supported.success) {
      return {
        kind: "supported",
        zip,
        payload: supported.data
      };
    }

    const unsupported = dashboardUnsupportedResponseSchema.safeParse(payload);
    if (unsupported.success) {
      return {
        kind: "unsupported",
        zip,
        payload: unsupported.data
      };
    }

    return {
      kind: "internal_error",
      zip,
      message: FALLBACK_INTERNAL_ERROR
    };
  }

  const parsedError = apiErrorEnvelopeSchema.safeParse(payload);
  if (!parsedError.success) {
    return {
      kind: "internal_error",
      zip,
      message: FALLBACK_INTERNAL_ERROR
    };
  }

  const message = parsedError.data.error.message;
  return mapApiErrorCode(zip, parsedError.data.error.code, message);
}

export async function fetchDashboardState(
  zip: string,
  options: FetchDashboardStateOptions = {}
): Promise<DashboardPageState> {
  const fetchFn = options.fetchFn ?? fetch;
  const searchParams = new URLSearchParams();

  if (options.segment) {
    searchParams.set("segment", options.segment);
  }

  if (typeof options.months === "number") {
    searchParams.set("months", String(options.months));
  }

  const query = searchParams.toString();
  const requestPath = query
    ? `/api/v1/dashboard/${zip}?${query}`
    : `/api/v1/dashboard/${zip}`;

  try {
    const response = await fetchFn(requestPath, {
      headers: {
        accept: "application/json"
      },
      cache: "no-store"
    });

    const payload = await response
      .json()
      .catch(() => ({ error: { code: "INTERNAL_ERROR", message: FALLBACK_INTERNAL_ERROR } }));

    return mapDashboardResponse(zip, response.status, payload);
  } catch {
    return {
      kind: "internal_error",
      zip,
      message: FALLBACK_INTERNAL_ERROR
    };
  }
}
