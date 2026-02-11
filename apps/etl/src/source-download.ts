import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

export interface DownloadedSource {
  filePath: string;
  checksumSha256: string;
  downloadedAt: Date;
  sizeBytes: number;
  cleanup: () => Promise<void>;
}

function inferFileExtension(sourceUrl: string): string {
  const match = sourceUrl.match(/\.[a-z0-9]+(?=$|[?#])/i);
  return match?.[0] ?? ".tmp";
}

function sanitizeSourceName(sourceName: string): string {
  return sourceName.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
}

export async function downloadSourceToTempFile(
  sourceName: string,
  sourceUrl: string
): Promise<DownloadedSource> {
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to download ${sourceName} source: HTTP ${response.status}`);
  }
  if (!response.body) {
    throw new Error(`Failed to download ${sourceName} source: empty response body`);
  }

  const downloadDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), `zipmarket-${sanitizeSourceName(sourceName)}-`)
  );
  const filePath = path.join(downloadDirectory, `source${inferFileExtension(sourceUrl)}`);
  const checksum = createHash("sha256");
  let sizeBytes = 0;

  const checksumTap = new Transform({
    transform(chunk: Buffer | Uint8Array, _encoding, callback) {
      const normalizedChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      sizeBytes += normalizedChunk.length;
      checksum.update(normalizedChunk);
      callback(null, normalizedChunk);
    }
  });

  await pipeline(
    Readable.fromWeb(response.body as globalThis.ReadableStream<Uint8Array>),
    checksumTap,
    createWriteStream(filePath)
  );

  return {
    filePath,
    checksumSha256: checksum.digest("hex"),
    downloadedAt: new Date(),
    sizeBytes,
    cleanup: async () => {
      await fs.rm(downloadDirectory, { recursive: true, force: true });
    }
  };
}
