import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_LOCAL_DATABASE_URL, resolveDatabaseUrl } from "./env.js";

test("resolveDatabaseUrl uses DATABASE_URL when configured", () => {
  const resolved = resolveDatabaseUrl({
    DATABASE_URL: "  postgresql://demo:demo@localhost:5432/demo_db  "
  } as NodeJS.ProcessEnv);

  assert.equal(resolved, "postgresql://demo:demo@localhost:5432/demo_db");
});

test("resolveDatabaseUrl falls back to local default when DATABASE_URL is missing", () => {
  const resolved = resolveDatabaseUrl({});
  assert.equal(resolved, DEFAULT_LOCAL_DATABASE_URL);
});
