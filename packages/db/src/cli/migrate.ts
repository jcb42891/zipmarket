import { createPgClient } from "../pg-client.js";
import { runMigrations } from "../migrate.js";

const client = createPgClient();

await client.connect();
try {
  const summary = await runMigrations(client);
  console.log(
    `Migrations complete. Discovered=${summary.discovered} Applied=${summary.applied.length} Skipped=${summary.skipped.length}`
  );
} finally {
  await client.end();
}
