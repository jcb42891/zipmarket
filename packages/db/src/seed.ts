import type { SqlExecutor } from "./migrate.js";
import {
  PROPERTY_TYPE_SEED_ROWS,
  type PropertyTypeSeedRow,
  validatePropertyTypeSeedRows
} from "./property-type-seed.js";

const UPSERT_PROPERTY_TYPE_SQL = `
INSERT INTO dim_property_type (property_type_key, source_property_type, is_mvp_exposed)
VALUES ($1, $2, $3)
ON CONFLICT (property_type_key) DO UPDATE
SET
  source_property_type = EXCLUDED.source_property_type,
  is_mvp_exposed = EXCLUDED.is_mvp_exposed
`;

export async function seedPropertyTypes(
  executor: SqlExecutor,
  rows: readonly PropertyTypeSeedRow[] = PROPERTY_TYPE_SEED_ROWS
): Promise<number> {
  validatePropertyTypeSeedRows(rows);

  await executor.query("BEGIN");
  try {
    for (const row of rows) {
      await executor.query(UPSERT_PROPERTY_TYPE_SQL, [
        row.propertyTypeKey,
        row.sourcePropertyType,
        row.isMvpExposed
      ]);
    }
    await executor.query("COMMIT");
  } catch (error) {
    await executor.query("ROLLBACK");
    throw new Error(
      `Failed to seed dim_property_type: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  return rows.length;
}
