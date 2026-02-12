import assert from "node:assert/strict";
import test from "node:test";

import {
  buildZipPath,
  normalizeZipInput,
  validateZipSubmission,
  ZIP_VALIDATION_MESSAGE
} from "./zip-search";

test("normalizeZipInput strips non-digit characters and clamps to 5 digits", () => {
  assert.equal(normalizeZipInput(" 07-001 north "), "07001");
  assert.equal(normalizeZipInput("1234567"), "12345");
});

test("validateZipSubmission returns error for non-5-digit value", () => {
  const result = validateZipSubmission("701");

  assert.deepEqual(result, {
    ok: false,
    zip: "701",
    error: ZIP_VALIDATION_MESSAGE
  });
});

test("validateZipSubmission returns normalized ZIP for valid input", () => {
  const result = validateZipSubmission("07 001");

  assert.deepEqual(result, {
    ok: true,
    zip: "07001"
  });
});

test("buildZipPath returns dashboard route path", () => {
  assert.equal(buildZipPath("07001"), "/zip/07001");
});
