import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import http from "node:http";
import test from "node:test";

import { downloadSourceToTempFile } from "./source-download.js";

test("downloadSourceToTempFile downloads content and computes checksum", async (t) => {
  const payload = Buffer.from("zipmarket-source-payload", "utf8");

  const server = http.createServer((_request, response) => {
    response.statusCode = 200;
    response.setHeader("content-type", "application/octet-stream");
    response.end(payload);
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  t.after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to resolve test server port");
  }

  const downloaded = await downloadSourceToTempFile(
    "test-source",
    `http://127.0.0.1:${address.port}/data.tsv.gz`
  );

  const expectedChecksum = createHash("sha256").update(payload).digest("hex");
  assert.equal(downloaded.checksumSha256, expectedChecksum);
  assert.equal(downloaded.sizeBytes, payload.length);

  const storedBytes = await fs.readFile(downloaded.filePath);
  assert.deepEqual(storedBytes, payload);

  await downloaded.cleanup();
  const existsAfterCleanup = await fs
    .stat(downloaded.filePath)
    .then(() => true)
    .catch(() => false);
  assert.equal(existsAfterCleanup, false);
});
