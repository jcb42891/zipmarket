import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface MigrationFile {
  name: string;
  sql: string;
  checksum: string;
}

const DEFAULT_MIGRATIONS_DIRECTORY = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "migrations"
);

export function getDefaultMigrationsDirectory(): string {
  return DEFAULT_MIGRATIONS_DIRECTORY;
}

function computeChecksum(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export async function discoverMigrations(
  migrationsDirectory: string = DEFAULT_MIGRATIONS_DIRECTORY
): Promise<MigrationFile[]> {
  const entries = await fs.readdir(migrationsDirectory, { withFileTypes: true });
  const filenames = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const migrations: MigrationFile[] = [];

  for (const filename of filenames) {
    const filePath = path.join(migrationsDirectory, filename);
    const sql = await fs.readFile(filePath, "utf8");
    migrations.push({
      name: filename,
      sql,
      checksum: computeChecksum(sql)
    });
  }

  return migrations;
}
