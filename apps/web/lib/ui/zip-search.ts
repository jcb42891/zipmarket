import { ZIP_CODE_REGEX } from "@zipmarket/shared";

export const ZIP_VALIDATION_MESSAGE = "Enter a 5-digit ZIP code.";

export type ZipSubmission =
  | { ok: true; zip: string }
  | { ok: false; zip: string; error: string };

export function normalizeZipInput(rawInput: string): string {
  return rawInput.replace(/[^\d]/g, "").slice(0, 5);
}

export function validateZipSubmission(rawInput: string): ZipSubmission {
  const normalized = normalizeZipInput(rawInput);

  if (!ZIP_CODE_REGEX.test(normalized)) {
    return {
      ok: false,
      zip: normalized,
      error: ZIP_VALIDATION_MESSAGE
    };
  }

  return {
    ok: true,
    zip: normalized
  };
}

export function buildZipPath(zip: string): string {
  return `/zip/${zip}`;
}
