import assert from "node:assert/strict";
import test from "node:test";

import type { QueryResult, SqlExecutor } from "./migrate.js";
import { findNearestSupportedZips, refreshMarts } from "./marts.js";

interface QueryCall {
  text: string;
  params?: readonly unknown[];
}

class FakeExecutor implements SqlExecutor {
  public readonly calls: QueryCall[] = [];

  public constructor(
    private readonly handlers: {
      refreshRows?: Array<{ updated_zip_rows: number | string; latest_rows: number | string; series_rows: number | string }>;
      nearestRows?: Array<{ zip_code: string; distance_miles: number | string }>;
    } = {}
  ) {}

  public async query<Row = unknown>(
    text: string,
    params?: readonly unknown[]
  ): Promise<QueryResult<Row>> {
    this.calls.push({ text, params });

    if (text.includes("refresh_zipmarket_marts")) {
      return {
        rows: (this.handlers.refreshRows ?? []) as Row[],
        rowCount: this.handlers.refreshRows?.length ?? 0
      };
    }

    if (text.includes("find_nearest_supported_zips")) {
      return {
        rows: (this.handlers.nearestRows ?? []) as Row[],
        rowCount: this.handlers.nearestRows?.length ?? 0
      };
    }

    return {
      rows: [],
      rowCount: 0
    };
  }
}

test("refreshMarts returns parsed summary values", async () => {
  const executor = new FakeExecutor({
    refreshRows: [{ updated_zip_rows: "7", latest_rows: "12", series_rows: 311 }]
  });

  const summary = await refreshMarts(executor);

  assert.deepEqual(summary, {
    updatedZipRows: 7,
    latestRows: 12,
    seriesRows: 311
  });
  assert.ok(
    executor.calls.some((call) => call.text.includes("refresh_zipmarket_marts"))
  );
});

test("refreshMarts throws when SQL function returns no rows", async () => {
  const executor = new FakeExecutor({
    refreshRows: []
  });

  await assert.rejects(refreshMarts(executor), /return one summary row/);
});

test("findNearestSupportedZips validates input and maps results", async () => {
  const executor = new FakeExecutor({
    nearestRows: [
      { zip_code: "07001", distance_miles: "1.25" },
      { zip_code: "07002", distance_miles: 2.75 }
    ]
  });

  const results = await findNearestSupportedZips(executor, "07000", 2);

  assert.deepEqual(results, [
    { zipCode: "07001", distanceMiles: 1.25 },
    { zipCode: "07002", distanceMiles: 2.75 }
  ]);
  assert.deepEqual(executor.calls[0]?.params, ["07000", 2]);
});

test("findNearestSupportedZips rejects invalid inputs", async () => {
  const executor = new FakeExecutor();

  await assert.rejects(
    findNearestSupportedZips(executor, "7000", 5),
    /5-digit ZIP/
  );
  await assert.rejects(
    findNearestSupportedZips(executor, "07001", 0),
    /between 1 and 50/
  );
});
