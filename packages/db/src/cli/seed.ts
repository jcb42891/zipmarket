import { createPgClient } from "../pg-client.js";
import { seedPropertyTypes } from "../seed.js";

const client = createPgClient();

await client.connect();
try {
  const seededRows = await seedPropertyTypes(client);
  console.log(`Seed complete. Inserted or updated ${seededRows} dim_property_type rows.`);
} finally {
  await client.end();
}
