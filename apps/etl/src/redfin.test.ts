import assert from "node:assert/strict";
import test from "node:test";

import type { QueryResult, SqlExecutor } from "@zipmarket/db";

import {
  ingestRedfinLines,
  parseRedfinHeader,
  parseRedfinLine
} from "./redfin.js";
import type { LineRecord } from "./line-reader.js";

const HEADER = [
  "REGION_TYPE",
  "STATE_CODE",
  "IS_SEASONALLY_ADJUSTED",
  "PROPERTY_TYPE",
  "REGION",
  "PERIOD_BEGIN",
  "PERIOD_END",
  "LAST_UPDATED",
  "MEDIAN_SALE_PRICE",
  "MEDIAN_LIST_PRICE",
  "HOMES_SOLD",
  "NEW_LISTINGS",
  "AVG_SALE_TO_LIST",
  "SOLD_ABOVE_LIST",
  "MEDIAN_SALE_PRICE_MOM",
  "MEDIAN_SALE_PRICE_YOY",
  "MEDIAN_LIST_PRICE_MOM",
  "MEDIAN_LIST_PRICE_YOY",
  "HOMES_SOLD_YOY",
  "NEW_LISTINGS_YOY",
  "AVG_SALE_TO_LIST_YOY",
  "SOLD_ABOVE_LIST_YOY"
].join("\t");

const QUOTED_HEADER = HEADER.split("\t")
  .map((value) => `"${value}"`)
  .join("\t");

const VALID_ROW = [
  "zip code",
  "NJ",
  "false",
  "All Residential",
  "Zip Code: 07001",
  "2025-11-01",
  "2025-11-30",
  "2025-12-05",
  "500000",
  "510000",
  "23",
  "30",
  "1.015",
  "0.37",
  "0.01",
  "0.04",
  "NA",
  "0.03",
  "0.10",
  "NA",
  "0.005",
  "-0.02"
].join("\t");

const QUOTED_VALID_ROW = VALID_ROW.split("\t")
  .map((value) => `"${value}"`)
  .join("\t");

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

test("parseRedfinHeader validates required columns", () => {
  const parsedHeader = parseRedfinHeader(HEADER);
  assert.equal(parsedHeader.ok, true);

  const quotedHeader = parseRedfinHeader(QUOTED_HEADER);
  assert.equal(quotedHeader.ok, true);

  const missingColumnsHeader = parseRedfinHeader(
    HEADER.replace("SOLD_ABOVE_LIST_YOY", "MISSING_COLUMN")
  );
  assert.equal(missingColumnsHeader.ok, false);
  if (missingColumnsHeader.ok) {
    throw new Error("Expected missing column validation to fail");
  }
  assert.match(missingColumnsHeader.reason, /missing_required_columns/);
});

test("parseRedfinLine normalizes valid rows and converts NA values to null", () => {
  const parsedHeader = parseRedfinHeader(HEADER);
  if (!parsedHeader.ok) {
    throw new Error("Expected header to parse");
  }

  const result = parseRedfinLine(
    QUOTED_VALID_ROW,
    parsedHeader.headerMap,
    new Map([["07001", "NJ"]])
  );

  assert.equal(result.kind, "record");
  if (result.kind !== "record") {
    throw new Error("Expected valid Redfin row");
  }

  assert.deepEqual(result.record, {
    zipCode: "07001",
    periodBegin: "2025-11-01",
    periodEnd: "2025-11-30",
    propertyTypeKey: "all",
    medianSalePrice: 500000,
    medianListPrice: 510000,
    homesSold: 23,
    newListings: 30,
    avgSaleToList: 1.015,
    soldAboveList: 0.37,
    medianSalePriceMom: 0.01,
    medianSalePriceYoy: 0.04,
    medianListPriceMom: null,
    medianListPriceYoy: 0.03,
    homesSoldYoy: 0.1,
    newListingsYoy: null,
    avgSaleToListYoy: 0.005,
    soldAboveListYoy: -0.02,
    sourceLastUpdated: "2025-12-05T00:00:00.000Z"
  });
});

test("parseRedfinLine skips non-target rows and rejects invalid rows", () => {
  const parsedHeader = parseRedfinHeader(HEADER);
  if (!parsedHeader.ok) {
    throw new Error("Expected header to parse");
  }

  const nonNjRow = parseRedfinLine(
    VALID_ROW.replace("\tNJ\t", "\tNY\t"),
    parsedHeader.headerMap,
    new Map([["07001", "NJ"]])
  );
  assert.deepEqual(nonNjRow, { kind: "skip" });

  const unknownPropertyRow = parseRedfinLine(
    VALID_ROW.replace("All Residential", "Castle"),
    parsedHeader.headerMap,
    new Map([["07001", "NJ"]])
  );
  assert.deepEqual(unknownPropertyRow, { kind: "reject", reason: "unknown_property_type" });

  const stateMismatchRow = parseRedfinLine(
    VALID_ROW,
    parsedHeader.headerMap,
    new Map([["07001", "PA"]])
  );
  assert.deepEqual(stateMismatchRow, { kind: "reject", reason: "zip_state_mismatch" });
});

test("ingestRedfinLines upserts valid rows and logs rejects", async () => {
  const executor = new FakeExecutor();
  let rowsRead = 0;
  let rowsWritten = 0;
  const rejects: Array<{ reason: string; lineNumber?: number }> = [];

  await ingestRedfinLines(
    fromLines([
      { lineNumber: 1, line: HEADER },
      { lineNumber: 2, line: VALID_ROW },
      { lineNumber: 3, line: VALID_ROW.replace("All Residential", "Castle") }
    ]),
    new Map([["07001", "NJ"]]),
    {
      runId: "33333333-3333-3333-3333-333333333333",
      executor,
      incrementRowsRead: () => {
        rowsRead += 1;
      },
      incrementRowsWritten: () => {
        rowsWritten += 1;
      },
      reject: async (record) => {
        rejects.push({ reason: record.reason, lineNumber: record.lineNumber });
      }
    }
  );

  assert.equal(rowsRead, 2);
  assert.equal(rowsWritten, 1);
  assert.equal(rejects.length, 1);
  assert.deepEqual(rejects[0], { reason: "unknown_property_type", lineNumber: 3 });

  const upsertCalls = executor.calls.filter((call) =>
    call.text.includes("INSERT INTO fact_zip_market_monthly")
  );
  assert.equal(upsertCalls.length, 1);
  assert.equal(upsertCalls[0]?.params?.[0], "07001");
});
