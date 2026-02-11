import assert from "node:assert/strict";
import test from "node:test";

import type { QueryResult, SqlExecutor } from "@zipmarket/db";

import {
  runIngestionJob,
  type IngestionJobContext,
  type IngestionSourceConfig
} from "./framework.js";
import type { DownloadedSource } from "./source-download.js";

interface QueryCall {
  text: string;
  params?: readonly unknown[];
}

class FakeExecutor implements SqlExecutor {
  public readonly calls: QueryCall[] = [];

  public constructor(private readonly lockAvailable = true) {}

  public async query<Row = unknown>(
    text: string,
    params?: readonly unknown[]
  ): Promise<QueryResult<Row>> {
    this.calls.push({ text, params });

    if (text.includes("SELECT pg_try_advisory_lock")) {
      return {
        rows: [{ locked: this.lockAvailable }] as Row[],
        rowCount: 1
      };
    }

    return {
      rows: [],
      rowCount: 0
    };
  }
}

const TEST_SOURCE: IngestionSourceConfig = {
  sourceName: "geonames",
  sourceUrl: "https://example.com/us.zip",
  advisoryLockKey: 12345
};

function createDownloadedSource(cleanupTracker: { cleaned: boolean }): DownloadedSource {
  return {
    filePath: "C:/tmp/source.zip",
    checksumSha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    downloadedAt: new Date("2026-02-11T12:00:00.000Z"),
    sizeBytes: 128,
    cleanup: async () => {
      cleanupTracker.cleaned = true;
    }
  };
}

test("runIngestionJob records successful lifecycle with counters and rejects", async () => {
  const executor = new FakeExecutor(true);
  const cleanupTracker = { cleaned: false };

  const summary = await runIngestionJob(executor, TEST_SOURCE, {
    createRunId: () => "11111111-1111-1111-1111-111111111111",
    now: () => new Date("2026-02-11T12:34:56.000Z"),
    downloadSource: async () => createDownloadedSource(cleanupTracker),
    execute: async (context: IngestionJobContext) => {
      context.incrementRowsRead(2);
      context.incrementRowsWritten();
      await context.reject({
        reason: "invalid_zip_code",
        lineNumber: 9,
        rawPayload: "bad-row"
      });
    }
  });

  assert.equal(summary.runId, "11111111-1111-1111-1111-111111111111");
  assert.equal(summary.rowsRead, 2);
  assert.equal(summary.rowsWritten, 1);
  assert.equal(summary.rowsRejected, 1);
  assert.equal(cleanupTracker.cleaned, true);

  const updateRunCall = executor.calls.find((call) =>
    call.text.includes("UPDATE ingestion_run")
  );
  assert.equal(updateRunCall?.params?.[2], "succeeded");

  assert.ok(executor.calls.some((call) => call.text.includes("INSERT INTO ingestion_reject")));
  assert.ok(executor.calls.some((call) => call.text.includes("SELECT pg_advisory_unlock")));
});

test("runIngestionJob marks run as failed when execute throws", async () => {
  const executor = new FakeExecutor(true);
  const cleanupTracker = { cleaned: false };

  await assert.rejects(
    runIngestionJob(executor, TEST_SOURCE, {
      createRunId: () => "22222222-2222-2222-2222-222222222222",
      now: () => new Date("2026-02-11T13:00:00.000Z"),
      downloadSource: async () => createDownloadedSource(cleanupTracker),
      execute: async () => {
        throw new Error("forced ingest failure");
      }
    }),
    /forced ingest failure/
  );

  assert.equal(cleanupTracker.cleaned, true);

  const updateRunCall = executor.calls.find((call) =>
    call.text.includes("UPDATE ingestion_run")
  );
  assert.equal(updateRunCall?.params?.[2], "failed");
  assert.match(String(updateRunCall?.params?.[6]), /forced ingest failure/);
  assert.ok(executor.calls.some((call) => call.text.includes("SELECT pg_advisory_unlock")));
});

test("runIngestionJob fails fast when advisory lock is unavailable", async () => {
  const executor = new FakeExecutor(false);
  let downloadCalled = false;

  await assert.rejects(
    runIngestionJob(executor, TEST_SOURCE, {
      downloadSource: async () => {
        downloadCalled = true;
        throw new Error("should not be called");
      },
      execute: async () => {
        throw new Error("should not run");
      }
    }),
    /already in progress/
  );

  assert.equal(downloadCalled, false);
  assert.equal(
    executor.calls.some((call) => call.text.includes("INSERT INTO ingestion_run")),
    false
  );
});
