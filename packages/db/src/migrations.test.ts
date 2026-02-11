import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { discoverMigrations } from "./migrations.js";

test("discoverMigrations loads SQL files in lexicographic order with checksums", async (t) => {
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "zipmarket-migrations-"));
  t.after(async () => {
    await fs.rm(tempDirectory, { recursive: true, force: true });
  });

  await fs.writeFile(path.join(tempDirectory, "002_second.sql"), "SELECT 2;\n", "utf8");
  await fs.writeFile(path.join(tempDirectory, "001_first.sql"), "SELECT 1;\n", "utf8");
  await fs.writeFile(path.join(tempDirectory, "README.txt"), "ignored", "utf8");

  const migrations = await discoverMigrations(tempDirectory);

  assert.deepEqual(
    migrations.map((migration) => migration.name),
    ["001_first.sql", "002_second.sql"]
  );
  assert.equal(migrations[0].sql, "SELECT 1;\n");
  assert.equal(migrations[0].checksum.length, 64);
  assert.equal(migrations[1].checksum.length, 64);
});
