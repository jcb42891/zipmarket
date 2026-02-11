import { Client } from "pg";

import { resolveDatabaseUrl } from "./env.js";

export function createPgClient(databaseUrl: string = resolveDatabaseUrl()): Client {
  return new Client({ connectionString: databaseUrl });
}
