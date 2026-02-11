import assert from "node:assert/strict";
import test from "node:test";

import type { SqlExecutor } from "./migrate.js";
import { PROPERTY_TYPE_SEED_ROWS } from "./property-type-seed.js";
import { seedPropertyTypes } from "./seed.js";

interface QueryCall {
  text: string;
  params?: readonly unknown[];
}

class FakeExecutor implements SqlExecutor {
  public readonly calls: QueryCall[] = [];

  public constructor(private readonly failWhenTextIncludes?: string) {}

  public async query<Row = unknown>(
    text: string,
    params?: readonly unknown[]
  ): Promise<{ rows: Row[]; rowCount: number | null }> {
    this.calls.push({ text, params });

    if (this.failWhenTextIncludes && text.includes(this.failWhenTextIncludes)) {
      throw new Error("forced failure");
    }

    return {
      rows: [],
      rowCount: 0
    };
  }
}

test("seedPropertyTypes upserts all default rows in a transaction", async () => {
  const executor = new FakeExecutor();

  const seededRows = await seedPropertyTypes(executor);

  assert.equal(seededRows, PROPERTY_TYPE_SEED_ROWS.length);
  assert.equal(executor.calls[0]?.text, "BEGIN");
  assert.equal(executor.calls.at(-1)?.text, "COMMIT");

  const upsertCalls = executor.calls.filter((call) => call.text.includes("INSERT INTO dim_property_type"));
  assert.equal(upsertCalls.length, PROPERTY_TYPE_SEED_ROWS.length);
  assert.deepEqual(upsertCalls[0]?.params, [
    "all",
    "All Residential",
    true
  ]);
});

test("seedPropertyTypes validates duplicate property_type_key values", async () => {
  const executor = new FakeExecutor();

  await assert.rejects(
    seedPropertyTypes(executor, [
      {
        propertyTypeKey: "all",
        sourcePropertyType: "Any",
        isMvpExposed: true
      },
      {
        propertyTypeKey: "all",
        sourcePropertyType: "Duplicate",
        isMvpExposed: true
      }
    ]),
    /Duplicate property_type_key/
  );
  assert.equal(executor.calls.length, 0);
});

test("seedPropertyTypes rolls back when upsert fails", async () => {
  const executor = new FakeExecutor("INSERT INTO dim_property_type");

  await assert.rejects(seedPropertyTypes(executor), /Failed to seed dim_property_type/);
  assert.equal(executor.calls[0]?.text, "BEGIN");
  assert.equal(executor.calls.at(-1)?.text, "ROLLBACK");
});
