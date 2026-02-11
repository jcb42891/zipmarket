import { pathToFileURL } from "node:url";

import {
  createPgClient,
  type RefreshMartsSummary,
  type SqlExecutor
} from "@zipmarket/db";

import { resolveEtlConfig, type EtlConfig } from "./env.js";
import { type IngestionSummary } from "./framework.js";
import { runGeonamesIngestion } from "./geonames.js";
import {
  formatRedfinDataQualityReport,
  type RedfinDataQualityReport
} from "./redfin-data-quality.js";
import { runRedfinIngestion } from "./redfin.js";

export const HELP_TEXT = `
ZipMarket ETL CLI

Usage:
  npm run etl -- --help
  npm run etl -- geonames
  npm run etl -- redfin
  npm run etl -- run-all

Commands:
  geonames   Ingest GeoNames ZIP metadata into dim_zip
  redfin     Ingest Redfin ZIP market rows, run DQ checks, refresh marts
  run-all    Run geonames then redfin in sequence
`;

export interface CliDependencies {
  resolveConfig: () => EtlConfig;
  runGeonames: (executor: SqlExecutor, config: EtlConfig) => Promise<IngestionSummary>;
  runRedfin: (executor: SqlExecutor, config: EtlConfig) => Promise<IngestionSummary>;
  withConnectedExecutor: <T>(
    databaseUrl: string,
    handler: (executor: SqlExecutor) => Promise<T>
  ) => Promise<T>;
  log: (message: string) => void;
  error: (message: string) => void;
}

async function withConnectedClient<T>(
  databaseUrl: string,
  handler: (executor: SqlExecutor) => Promise<T>
): Promise<T> {
  const client = createPgClient(databaseUrl);
  await client.connect();
  try {
    return await handler(client);
  } finally {
    await client.end();
  }
}

function formatSummary(summary: IngestionSummary): string {
  return [
    `[etl] ${summary.sourceName} succeeded`,
    `run_id=${summary.runId}`,
    `rows_read=${summary.rowsRead}`,
    `rows_written=${summary.rowsWritten}`,
    `rows_rejected=${summary.rowsRejected}`,
    `checksum_sha256=${summary.sourceChecksumSha256}`
  ].join(" ");
}

function formatMartRefreshSummary(summary: RefreshMartsSummary): string {
  return [
    "[etl] mart refresh succeeded",
    `updated_zip_rows=${summary.updatedZipRows}`,
    `latest_rows=${summary.latestRows}`,
    `series_rows=${summary.seriesRows}`
  ].join(" ");
}

function hasRedfinDataQualityReport(
  summary: IngestionSummary
): summary is IngestionSummary & { dataQualityReport: RedfinDataQualityReport } {
  const candidate = summary as { dataQualityReport?: unknown };
  return typeof candidate.dataQualityReport === "object" && candidate.dataQualityReport !== null;
}

function hasMartRefreshSummary(
  summary: IngestionSummary
): summary is IngestionSummary & { martRefresh: RefreshMartsSummary } {
  const candidate = summary as { martRefresh?: unknown };
  return typeof candidate.martRefresh === "object" && candidate.martRefresh !== null;
}

function logRedfinPostIngestDetails(summary: IngestionSummary, log: (message: string) => void): void {
  if (hasRedfinDataQualityReport(summary)) {
    log(formatRedfinDataQualityReport(summary.dataQualityReport));
  }

  if (hasMartRefreshSummary(summary)) {
    log(formatMartRefreshSummary(summary.martRefresh));
  }
}

export function createDefaultDependencies(): CliDependencies {
  return {
    resolveConfig: () => resolveEtlConfig(),
    runGeonames: (executor, config) => runGeonamesIngestion(executor, config.geonamesUsZipUrl),
    runRedfin: (executor, config) => runRedfinIngestion(executor, config.redfinZipFeedUrl),
    withConnectedExecutor: (databaseUrl, handler) => withConnectedClient(databaseUrl, handler),
    log: (message) => {
      console.log(message);
    },
    error: (message) => {
      console.error(message);
    }
  };
}

export async function executeCli(
  argv: readonly string[],
  dependencies: CliDependencies = createDefaultDependencies()
): Promise<number> {
  const [command, ...args] = argv;
  if (!command || command === "--help" || command === "-h" || args.includes("--help") || args.includes("-h")) {
    dependencies.log(HELP_TEXT.trim());
    return 0;
  }

  const config = dependencies.resolveConfig();

  try {
    switch (command) {
      case "geonames": {
        await dependencies.withConnectedExecutor(config.databaseUrl, async (executor) => {
          const summary = await dependencies.runGeonames(executor, config);
          dependencies.log(formatSummary(summary));
        });
        return 0;
      }
      case "redfin": {
        await dependencies.withConnectedExecutor(config.databaseUrl, async (executor) => {
          const summary = await dependencies.runRedfin(executor, config);
          dependencies.log(formatSummary(summary));
          logRedfinPostIngestDetails(summary, dependencies.log);
        });
        return 0;
      }
      case "run-all": {
        await dependencies.withConnectedExecutor(config.databaseUrl, async (executor) => {
          const geonamesSummary = await dependencies.runGeonames(executor, config);
          dependencies.log(formatSummary(geonamesSummary));
          const redfinSummary = await dependencies.runRedfin(executor, config);
          dependencies.log(formatSummary(redfinSummary));
          logRedfinPostIngestDetails(redfinSummary, dependencies.log);
        });
        return 0;
      }
      default:
        dependencies.error(`[etl] Unknown command: ${command}`);
        dependencies.log(HELP_TEXT.trim());
        return 1;
    }
  } catch (error) {
    dependencies.error(
      `[etl] command failed: ${error instanceof Error ? error.message : String(error)}`
    );
    return 1;
  }
}

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<void> {
  const exitCode = await executeCli(argv);
  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}

function isMainModule(): boolean {
  const entryFile = process.argv[1];
  if (!entryFile) {
    return false;
  }
  return import.meta.url === pathToFileURL(entryFile).href;
}

if (isMainModule()) {
  void main();
}
