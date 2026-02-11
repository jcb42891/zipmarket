import { randomUUID } from "node:crypto";

import type { SqlExecutor } from "@zipmarket/db";

import {
  downloadSourceToTempFile,
  type DownloadedSource
} from "./source-download.js";

interface AdvisoryLockRow {
  locked: boolean;
}

export interface IngestionSourceConfig {
  sourceName: string;
  sourceUrl: string;
  advisoryLockKey: number;
}

export interface IngestionSummary {
  runId: string;
  sourceName: string;
  sourceUrl: string;
  sourceChecksumSha256: string;
  downloadedAt: string;
  rowsRead: number;
  rowsWritten: number;
  rowsRejected: number;
}

export interface IngestionRejectRecord {
  reason: string;
  lineNumber?: number;
  rawPayload?: string;
}

export interface IngestionJobContext {
  runId: string;
  source: IngestionSourceConfig;
  downloadedSource: DownloadedSource;
  executor: SqlExecutor;
  incrementRowsRead: (count?: number) => void;
  incrementRowsWritten: (count?: number) => void;
  reject: (rejectRecord: IngestionRejectRecord) => Promise<void>;
}

export interface RunIngestionJobOptions {
  execute: (context: IngestionJobContext) => Promise<void>;
  downloadSource?: (sourceName: string, sourceUrl: string) => Promise<DownloadedSource>;
  createRunId?: () => string;
  now?: () => Date;
}

interface IngestionCounters {
  rowsRead: number;
  rowsWritten: number;
  rowsRejected: number;
}

const INSERT_INGESTION_RUN_SQL = `
INSERT INTO ingestion_run (
  run_id,
  status,
  source_name,
  source_url,
  source_checksum_sha256
)
VALUES ($1, 'running', $2, $3, $4)
`;

const UPSERT_SOURCE_SNAPSHOT_SQL = `
INSERT INTO source_snapshot (
  snapshot_id,
  ingestion_run_id,
  source_name,
  source_url,
  source_checksum_sha256,
  downloaded_at
)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (source_name, source_checksum_sha256) DO UPDATE
SET
  ingestion_run_id = EXCLUDED.ingestion_run_id,
  source_url = EXCLUDED.source_url,
  downloaded_at = EXCLUDED.downloaded_at
`;

const INSERT_INGESTION_REJECT_SQL = `
INSERT INTO ingestion_reject (
  ingestion_run_id,
  source_name,
  line_number,
  reject_reason,
  raw_payload
)
VALUES ($1, $2, $3, $4, $5)
`;

const UPDATE_INGESTION_RUN_SQL = `
UPDATE ingestion_run
SET
  finished_at = $2,
  status = $3,
  rows_read = $4,
  rows_written = $5,
  rows_rejected = $6,
  error_summary = $7
WHERE run_id = $1
`;

const TRY_ADVISORY_LOCK_SQL = "SELECT pg_try_advisory_lock($1) AS locked";
const RELEASE_ADVISORY_LOCK_SQL = "SELECT pg_advisory_unlock($1)";

function incrementCounter(counter: keyof IngestionCounters, counters: IngestionCounters, count = 1): void {
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error(`Expected positive integer increment for ${counter}, received ${count}`);
  }
  counters[counter] += count;
}

function trimErrorSummary(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.length > 1024 ? `${message.slice(0, 1021)}...` : message;
}

async function finalizeIngestionRun(
  executor: SqlExecutor,
  runId: string,
  status: "succeeded" | "failed",
  counters: IngestionCounters,
  finishedAt: Date,
  errorSummary: string | null
): Promise<void> {
  await executor.query(UPDATE_INGESTION_RUN_SQL, [
    runId,
    finishedAt.toISOString(),
    status,
    counters.rowsRead,
    counters.rowsWritten,
    counters.rowsRejected,
    errorSummary
  ]);
}

async function acquireAdvisoryLock(
  executor: SqlExecutor,
  advisoryLockKey: number,
  sourceName: string
): Promise<void> {
  const lockResult = await executor.query<AdvisoryLockRow>(TRY_ADVISORY_LOCK_SQL, [advisoryLockKey]);
  const locked = lockResult.rows[0]?.locked ?? false;
  if (!locked) {
    throw new Error(`Another ${sourceName} ingestion run is already in progress.`);
  }
}

export async function runIngestionJob(
  executor: SqlExecutor,
  source: IngestionSourceConfig,
  options: RunIngestionJobOptions
): Promise<IngestionSummary> {
  const downloadSource = options.downloadSource ?? downloadSourceToTempFile;
  const createRunId = options.createRunId ?? randomUUID;
  const now = options.now ?? (() => new Date());
  const counters: IngestionCounters = {
    rowsRead: 0,
    rowsWritten: 0,
    rowsRejected: 0
  };
  const runId = createRunId();
  let downloadedSource: DownloadedSource | undefined;
  let insertedRun = false;
  let hasAdvisoryLock = false;

  try {
    await acquireAdvisoryLock(executor, source.advisoryLockKey, source.sourceName);
    hasAdvisoryLock = true;

    downloadedSource = await downloadSource(source.sourceName, source.sourceUrl);

    await executor.query(INSERT_INGESTION_RUN_SQL, [
      runId,
      source.sourceName,
      source.sourceUrl,
      downloadedSource.checksumSha256
    ]);
    insertedRun = true;

    await executor.query(UPSERT_SOURCE_SNAPSHOT_SQL, [
      randomUUID(),
      runId,
      source.sourceName,
      source.sourceUrl,
      downloadedSource.checksumSha256,
      downloadedSource.downloadedAt.toISOString()
    ]);

    const context: IngestionJobContext = {
      runId,
      source,
      downloadedSource,
      executor,
      incrementRowsRead: (count = 1) => {
        incrementCounter("rowsRead", counters, count);
      },
      incrementRowsWritten: (count = 1) => {
        incrementCounter("rowsWritten", counters, count);
      },
      reject: async (rejectRecord) => {
        await executor.query(INSERT_INGESTION_REJECT_SQL, [
          runId,
          source.sourceName,
          rejectRecord.lineNumber ?? null,
          rejectRecord.reason,
          rejectRecord.rawPayload?.slice(0, 4000) ?? null
        ]);
        counters.rowsRejected += 1;
      }
    };

    await options.execute(context);
    await finalizeIngestionRun(executor, runId, "succeeded", counters, now(), null);

    return {
      runId,
      sourceName: source.sourceName,
      sourceUrl: source.sourceUrl,
      sourceChecksumSha256: downloadedSource.checksumSha256,
      downloadedAt: downloadedSource.downloadedAt.toISOString(),
      rowsRead: counters.rowsRead,
      rowsWritten: counters.rowsWritten,
      rowsRejected: counters.rowsRejected
    };
  } catch (error) {
    if (insertedRun) {
      await finalizeIngestionRun(
        executor,
        runId,
        "failed",
        counters,
        now(),
        trimErrorSummary(error)
      );
    }
    throw error;
  } finally {
    if (downloadedSource) {
      await downloadedSource.cleanup();
    }
    if (hasAdvisoryLock) {
      await executor.query(RELEASE_ADVISORY_LOCK_SQL, [source.advisoryLockKey]);
    }
  }
}
