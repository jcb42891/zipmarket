import assert from "node:assert/strict";
import test from "node:test";

import {
  buildZipPath,
  LOCATION_RESOLVE_FALLBACK_MESSAGE,
  LOCATION_VALIDATION_MESSAGE,
  normalizeLocationInput,
  resolveLocationToZip,
  validateLocationSubmission
} from "./zip-search";

test("normalizeLocationInput trims and collapses whitespace", () => {
  assert.equal(normalizeLocationInput("  Morristown   NJ "), "Morristown NJ");
  assert.equal(normalizeLocationInput(" 07001 "), "07001");
});

test("validateLocationSubmission returns error for empty input", () => {
  const result = validateLocationSubmission("   ");

  assert.deepEqual(result, {
    ok: false,
    query: "",
    error: LOCATION_VALIDATION_MESSAGE
  });
});

test("validateLocationSubmission classifies normalized ZIP input", () => {
  const result = validateLocationSubmission("07-001");

  assert.deepEqual(result, {
    ok: true,
    kind: "zip",
    zip: "07001"
  });
});

test("validateLocationSubmission classifies town input", () => {
  const result = validateLocationSubmission(" Morristown ");

  assert.deepEqual(result, {
    ok: true,
    kind: "town",
    query: "Morristown"
  });
});

test("buildZipPath returns dashboard route path", () => {
  assert.equal(buildZipPath("07001"), "/zip/07001");
});

test("resolveLocationToZip returns resolved ZIP for successful response", async () => {
  const result = await resolveLocationToZip("Morristown", {
    fetchFn: async (input) => {
      assert.equal(input, "/api/v1/locations/resolve?query=Morristown");
      return new Response(
        JSON.stringify({
          query: "Morristown",
          resolved_zip: "07960",
          match_type: "town",
          is_ambiguous: false,
          candidate_zips: ["07960"]
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      );
    }
  });

  assert.deepEqual(result, {
    ok: true,
    zip: "07960"
  });
});

test("resolveLocationToZip returns API error message when resolver fails", async () => {
  const result = await resolveLocationToZip("notatown", {
    fetchFn: async () =>
      new Response(
        JSON.stringify({
          error: {
            code: "LOCATION_NOT_FOUND",
            message: "Location could not be resolved to a New Jersey ZIP code."
          }
        }),
        {
          status: 404,
          headers: {
            "content-type": "application/json"
          }
        }
      )
  });

  assert.deepEqual(result, {
    ok: false,
    error: "Location could not be resolved to a New Jersey ZIP code."
  });
});

test("resolveLocationToZip falls back to generic message on network failure", async () => {
  const result = await resolveLocationToZip("Morristown", {
    fetchFn: async () => {
      throw new Error("network down");
    }
  });

  assert.deepEqual(result, {
    ok: false,
    error: LOCATION_RESOLVE_FALLBACK_MESSAGE
  });
});
