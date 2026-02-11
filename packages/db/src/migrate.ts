import { discoverMigrations, type MigrationFile } from "./migrations.js";

export interface QueryResult<Row = unknown> {
  rows: Row[];
  rowCount: number | null;
}

export interface SqlExecutor {
  query<Row = unknown>(
    text: string,
    params?: readonly unknown[]
  ): Promise<QueryResult<Row>>;
}

export interface MigrationRunSummary {
  discovered: number;
  applied: string[];
  skipped: string[];
}

interface AppliedMigrationRow {
  name: string;
  checksum: string;
}

const MIGRATION_TABLE_NAME = "_zipmarket_migrations";

const CREATE_MIGRATION_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE_NAME} (
  name TEXT PRIMARY KEY,
  checksum TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
`;

const LIST_APPLIED_MIGRATIONS_SQL = `
SELECT name, checksum
FROM ${MIGRATION_TABLE_NAME}
ORDER BY name
`;

const INSERT_APPLIED_MIGRATION_SQL = `
INSERT INTO ${MIGRATION_TABLE_NAME} (name, checksum)
VALUES ($1, $2)
`;

export async function runMigrations(
  executor: SqlExecutor,
  options: { migrations?: MigrationFile[] } = {}
): Promise<MigrationRunSummary> {
  const migrations = options.migrations ?? (await discoverMigrations());

  await executor.query(CREATE_MIGRATION_TABLE_SQL);
  const appliedRows = await executor.query<AppliedMigrationRow>(LIST_APPLIED_MIGRATIONS_SQL);
  const appliedByName = new Map(appliedRows.rows.map((row) => [row.name, row.checksum]));

  const applied: string[] = [];
  const skipped: string[] = [];

  for (const migration of migrations) {
    const existingChecksum = appliedByName.get(migration.name);

    if (existingChecksum) {
      if (existingChecksum !== migration.checksum) {
        throw new Error(
          `Migration checksum mismatch for ${migration.name}: expected ${existingChecksum} but found ${migration.checksum}.`
        );
      }
      skipped.push(migration.name);
      continue;
    }

    await executor.query("BEGIN");
    try {
      await executor.query(migration.sql);
      await executor.query(INSERT_APPLIED_MIGRATION_SQL, [migration.name, migration.checksum]);
      await executor.query("COMMIT");
      applied.push(migration.name);
    } catch (error) {
      await executor.query("ROLLBACK");
      throw new Error(
        `Failed to apply migration ${migration.name}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  return {
    discovered: migrations.length,
    applied,
    skipped
  };
}
