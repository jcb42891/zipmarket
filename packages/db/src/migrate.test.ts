import assert from "node:assert/strict";
import test from "node:test";

import { runMigrations, type SqlExecutor } from "./migrate.js";
import type { MigrationFile } from "./migrations.js";

interface QueryCall {
  text: string;
  params?: readonly unknown[];
}

class FakeExecutor implements SqlExecutor {
  public readonly calls: QueryCall[] = [];

  public constructor(
    private readonly applied: Array<{ name: string; checksum: string }> = [],
    private readonly failWhenTextIncludes?: string
  ) {}

  public async query<Row = unknown>(
    text: string,
    params?: readonly unknown[]
  ): Promise<{ rows: Row[]; rowCount: number | null }> {
    this.calls.push({ text, params });

    if (this.failWhenTextIncludes && text.includes(this.failWhenTextIncludes)) {
      throw new Error("forced failure");
    }

    if (text.includes("SELECT name, checksum")) {
      return {
        rows: this.applied as Row[],
        rowCount: this.applied.length
      };
    }

    return {
      rows: [],
      rowCount: 0
    };
  }
}

const MIGRATIONS: MigrationFile[] = [
  {
    name: "001_alpha.sql",
    sql: "SELECT 1;",
    checksum: "checksum-alpha"
  },
  {
    name: "002_beta.sql",
    sql: "SELECT 2;",
    checksum: "checksum-beta"
  }
];

test("runMigrations applies pending migrations and skips existing ones", async () => {
  const executor = new FakeExecutor([{ name: "001_alpha.sql", checksum: "checksum-alpha" }]);

  const summary = await runMigrations(executor, { migrations: MIGRATIONS });

  assert.equal(summary.discovered, 2);
  assert.deepEqual(summary.applied, ["002_beta.sql"]);
  assert.deepEqual(summary.skipped, ["001_alpha.sql"]);
  assert.equal(
    executor.calls.filter((call) => call.text === "BEGIN").length,
    1
  );
  assert.equal(
    executor.calls.filter((call) => call.text === "COMMIT").length,
    1
  );

  const insertCall = executor.calls.find((call) => call.text.includes("INSERT INTO _zipmarket_migrations"));
  assert.deepEqual(insertCall?.params, ["002_beta.sql", "checksum-beta"]);
});

test("runMigrations throws when an applied migration checksum has changed", async () => {
  const executor = new FakeExecutor([{ name: "001_alpha.sql", checksum: "different-checksum" }]);

  await assert.rejects(
    runMigrations(executor, { migrations: MIGRATIONS }),
    /Migration checksum mismatch/
  );
  assert.equal(
    executor.calls.filter((call) => call.text === "BEGIN").length,
    0
  );
});

test("runMigrations rolls back when a migration fails", async () => {
  const executor = new FakeExecutor([], "SELECT 2;");

  await assert.rejects(
    runMigrations(executor, { migrations: MIGRATIONS }),
    /Failed to apply migration 002_beta.sql/
  );
  assert.equal(
    executor.calls.filter((call) => call.text === "ROLLBACK").length,
    1
  );
});
