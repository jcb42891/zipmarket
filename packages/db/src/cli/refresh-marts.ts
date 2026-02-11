import { createPgClient } from "../pg-client.js";
import { refreshMarts } from "../marts.js";

const client = createPgClient();

await client.connect();
try {
  const summary = await refreshMarts(client);
  console.log(
    `Mart refresh complete. updated_zip_rows=${summary.updatedZipRows} latest_rows=${summary.latestRows} series_rows=${summary.seriesRows}`
  );
} finally {
  await client.end();
}
