import assert from "node:assert/strict";
import test from "node:test";

import type { QueryResult, SqlExecutor } from "@zipmarket/db";

import { ingestGeonamesLines, parseGeonamesLine } from "./geonames.js";
import type { LineRecord } from "./line-reader.js";

class FakeExecutor implements SqlExecutor {
  public readonly calls: Array<{ text: string; params?: readonly unknown[] }> = [];

  public async query<Row = unknown>(
    text: string,
    params?: readonly unknown[]
  ): Promise<QueryResult<Row>> {
    this.calls.push({ text, params });
    return {
      rows: [],
      rowCount: 1
    };
  }
}

async function* fromLines(lines: LineRecord[]): AsyncGenerator<LineRecord> {
  for (const line of lines) {
    yield line;
  }
}

test("parseGeonamesLine normalizes a valid line", () => {
  const result = parseGeonamesLine(
    "US\t07001\tAvenel\tNew Jersey\tNJ\tMiddlesex\t023\t\t\t40.5800\t-74.2700\t4"
  );

  assert.equal(result.ok, true);
  if (!result.ok) {
    throw new Error("Expected valid parse result");
  }

  assert.deepEqual(result.record, {
    zipCode: "07001",
    stateCode: "NJ",
    city: "Avenel",
    county: "Middlesex",
    latitude: 40.58,
    longitude: -74.27,
    isNj: true
  });
});

test("parseGeonamesLine rejects malformed records", () => {
  const invalidZip = parseGeonamesLine(
    "US\tABC01\tAvenel\tNew Jersey\tNJ\tMiddlesex\t023\t\t\t40.5800\t-74.2700\t4"
  );
  assert.deepEqual(invalidZip, {
    ok: false,
    reason: "invalid_zip_code"
  });

  const invalidLat = parseGeonamesLine(
    "US\t07001\tAvenel\tNew Jersey\tNJ\tMiddlesex\t023\t\t\tnot-a-number\t-74.2700\t4"
  );
  assert.deepEqual(invalidLat, {
    ok: false,
    reason: "invalid_latitude"
  });
});

test("ingestGeonamesLines writes valid rows and rejects invalid rows", async () => {
  const executor = new FakeExecutor();
  let rowsRead = 0;
  let rowsWritten = 0;
  const rejects: Array<{ reason: string; lineNumber?: number; rawPayload?: string }> = [];

  await ingestGeonamesLines(
    fromLines([
      {
        lineNumber: 1,
        line: "US\t07001\tAvenel\tNew Jersey\tNJ\tMiddlesex\t023\t\t\t40.5800\t-74.2700\t4"
      },
      {
        lineNumber: 2,
        line: "US\tbadzip\tAvenel\tNew Jersey\tNJ\tMiddlesex\t023\t\t\t40.5800\t-74.2700\t4"
      }
    ]),
    {
      executor,
      incrementRowsRead: () => {
        rowsRead += 1;
      },
      incrementRowsWritten: () => {
        rowsWritten += 1;
      },
      reject: async (record) => {
        rejects.push(record);
      }
    }
  );

  assert.equal(rowsRead, 2);
  assert.equal(rowsWritten, 1);
  assert.equal(rejects.length, 1);
  assert.equal(rejects[0]?.reason, "invalid_zip_code");

  const upsertCalls = executor.calls.filter((call) => call.text.includes("INSERT INTO dim_zip"));
  assert.equal(upsertCalls.length, 1);
  assert.deepEqual(upsertCalls[0]?.params?.slice(0, 2), ["07001", "NJ"]);
});
