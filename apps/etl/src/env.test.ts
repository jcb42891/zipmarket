import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_GEONAMES_US_ZIP_URL,
  DEFAULT_REDFIN_ZIP_FEED_URL,
  resolveEtlConfig
} from "./env.js";

test("resolveEtlConfig honors configured values and trims whitespace", () => {
  const config = resolveEtlConfig({
    DATABASE_URL: "  postgresql://demo:demo@localhost:5432/zipmarket  ",
    REDFIN_ZIP_FEED_URL: "  https://example.com/redfin.tsv.gz  ",
    GEONAMES_US_ZIP_URL: "  https://example.com/us.zip  "
  } as NodeJS.ProcessEnv);

  assert.deepEqual(config, {
    databaseUrl: "postgresql://demo:demo@localhost:5432/zipmarket",
    redfinZipFeedUrl: "https://example.com/redfin.tsv.gz",
    geonamesUsZipUrl: "https://example.com/us.zip"
  });
});

test("resolveEtlConfig falls back to default source URLs", () => {
  const config = resolveEtlConfig({
    DATABASE_URL: "postgresql://demo:demo@localhost:5432/zipmarket"
  } as NodeJS.ProcessEnv);

  assert.equal(config.redfinZipFeedUrl, DEFAULT_REDFIN_ZIP_FEED_URL);
  assert.equal(config.geonamesUsZipUrl, DEFAULT_GEONAMES_US_ZIP_URL);
});
