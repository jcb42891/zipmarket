import { resolveDatabaseUrl } from "@zipmarket/db";

export const DEFAULT_REDFIN_ZIP_FEED_URL =
  "https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_market_tracker/zip_code_market_tracker.tsv000.gz";

export const DEFAULT_GEONAMES_US_ZIP_URL = "https://download.geonames.org/export/zip/US.zip";

export interface EtlConfig {
  databaseUrl: string;
  redfinZipFeedUrl: string;
  geonamesUsZipUrl: string;
}

function resolveOptionalUrl(
  env: NodeJS.ProcessEnv,
  key: "REDFIN_ZIP_FEED_URL" | "GEONAMES_US_ZIP_URL",
  defaultValue: string
): string {
  const configuredValue = env[key]?.trim();
  return configuredValue || defaultValue;
}

export function resolveEtlConfig(env: NodeJS.ProcessEnv = process.env): EtlConfig {
  return {
    databaseUrl: resolveDatabaseUrl(env),
    redfinZipFeedUrl: resolveOptionalUrl(env, "REDFIN_ZIP_FEED_URL", DEFAULT_REDFIN_ZIP_FEED_URL),
    geonamesUsZipUrl: resolveOptionalUrl(env, "GEONAMES_US_ZIP_URL", DEFAULT_GEONAMES_US_ZIP_URL)
  };
}
