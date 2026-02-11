import assert from "node:assert/strict";
import test from "node:test";

import type { QueryResult, SqlExecutor } from "@zipmarket/db";

import { executeCli } from "./cli.js";
import type { CliDependencies } from "./cli.js";
import type { IngestionSummary } from "./framework.js";

class FakeExecutor implements SqlExecutor {
  public async query<Row = unknown>(): Promise<QueryResult<Row>> {
    return { rows: [], rowCount: 0 };
  }
}

const TEST_CONFIG = {
  databaseUrl: "postgresql://demo:demo@localhost:5432/zipmarket",
  redfinZipFeedUrl: "https://example.com/redfin.tsv.gz",
  geonamesUsZipUrl: "https://example.com/us.zip"
};

function makeSummary(sourceName: "geonames" | "redfin"): IngestionSummary {
  return {
    runId: `${sourceName}-run`,
    sourceName,
    sourceUrl: `https://example.com/${sourceName}`,
    sourceChecksumSha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    downloadedAt: "2026-02-11T00:00:00.000Z",
    rowsRead: 10,
    rowsWritten: 8,
    rowsRejected: 2
  };
}

function createDependencies(logs: string[], errors: string[]): CliDependencies {
  const executor = new FakeExecutor();
  return {
    resolveConfig: () => TEST_CONFIG,
    runGeonames: async () => makeSummary("geonames"),
    runRedfin: async () => makeSummary("redfin"),
    withConnectedExecutor: async (_databaseUrl, handler) => handler(executor),
    log: (message) => {
      logs.push(message);
    },
    error: (message) => {
      errors.push(message);
    }
  };
}

test("executeCli prints help when no command is provided", async () => {
  const logs: string[] = [];
  const errors: string[] = [];
  const dependencies = createDependencies(logs, errors);

  const exitCode = await executeCli([], dependencies);

  assert.equal(exitCode, 0);
  assert.equal(errors.length, 0);
  assert.match(logs[0] ?? "", /ZipMarket ETL CLI/);
});

test("executeCli rejects unknown commands", async () => {
  const logs: string[] = [];
  const errors: string[] = [];
  const dependencies = createDependencies(logs, errors);

  const exitCode = await executeCli(["unknown-command"], dependencies);

  assert.equal(exitCode, 1);
  assert.match(errors[0] ?? "", /Unknown command/);
  assert.match(logs[0] ?? "", /ZipMarket ETL CLI/);
});

test("executeCli run-all executes geonames then redfin", async () => {
  const logs: string[] = [];
  const errors: string[] = [];
  const callOrder: string[] = [];
  const executor = new FakeExecutor();

  const dependencies: CliDependencies = {
    resolveConfig: () => TEST_CONFIG,
    runGeonames: async () => {
      callOrder.push("geonames");
      return makeSummary("geonames");
    },
    runRedfin: async () => {
      callOrder.push("redfin");
      return makeSummary("redfin");
    },
    withConnectedExecutor: async (_databaseUrl, handler) => handler(executor),
    log: (message) => {
      logs.push(message);
    },
    error: (message) => {
      errors.push(message);
    }
  };

  const exitCode = await executeCli(["run-all"], dependencies);

  assert.equal(exitCode, 0);
  assert.deepEqual(callOrder, ["geonames", "redfin"]);
  assert.equal(logs.length, 2);
  assert.equal(errors.length, 0);
});
