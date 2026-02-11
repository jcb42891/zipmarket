import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";

import type { SqlExecutor } from "@zipmarket/db";
import { unzipSync } from "fflate";

import {
  runIngestionJob,
  type IngestionJobContext,
  type IngestionSummary
} from "./framework.js";
import { readLines, type LineRecord } from "./line-reader.js";

const GEONAMES_ADVISORY_LOCK_KEY = 209001;

const UPSERT_DIM_ZIP_SQL = `
INSERT INTO dim_zip (
  zip_code,
  state_code,
  city,
  county,
  latitude,
  longitude,
  geog,
  is_nj,
  updated_at
)
VALUES (
  $1,
  $2,
  $3,
  $4,
  $5,
  $6,
  ST_SetSRID(ST_MakePoint($6, $5), 4326)::geography,
  $7,
  NOW()
)
ON CONFLICT (zip_code) DO UPDATE
SET
  state_code = EXCLUDED.state_code,
  city = EXCLUDED.city,
  county = EXCLUDED.county,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  geog = EXCLUDED.geog,
  is_nj = EXCLUDED.is_nj,
  updated_at = NOW()
`;

export interface GeonamesZipRecord {
  zipCode: string;
  stateCode: string;
  city: string | null;
  county: string | null;
  latitude: number;
  longitude: number;
  isNj: boolean;
}

type GeonamesParseResult =
  | {
      ok: true;
      record: GeonamesZipRecord;
    }
  | {
      ok: false;
      reason: string;
    };

function parseCoordinate(
  rawValue: string,
  min: number,
  max: number
): number | null {
  const value = Number(rawValue.trim());
  if (!Number.isFinite(value) || value < min || value > max) {
    return null;
  }
  return value;
}

function normalizeOptionalText(rawValue: string): string | null {
  const normalized = rawValue.trim();
  return normalized.length > 0 ? normalized : null;
}

export function parseGeonamesLine(line: string): GeonamesParseResult {
  const columns = line.split("\t");
  if (columns.length < 11) {
    return {
      ok: false,
      reason: "invalid_column_count"
    };
  }

  const zipCode = columns[1]?.trim() ?? "";
  if (!/^\d{5}$/.test(zipCode)) {
    return {
      ok: false,
      reason: "invalid_zip_code"
    };
  }

  const stateCode = (columns[4] ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(stateCode)) {
    return {
      ok: false,
      reason: "invalid_state_code"
    };
  }

  const latitude = parseCoordinate(columns[9] ?? "", -90, 90);
  if (latitude === null) {
    return {
      ok: false,
      reason: "invalid_latitude"
    };
  }

  const longitude = parseCoordinate(columns[10] ?? "", -180, 180);
  if (longitude === null) {
    return {
      ok: false,
      reason: "invalid_longitude"
    };
  }

  return {
    ok: true,
    record: {
      zipCode,
      stateCode,
      city: normalizeOptionalText(columns[2] ?? ""),
      county: normalizeOptionalText(columns[5] ?? ""),
      latitude,
      longitude,
      isNj: stateCode === "NJ"
    }
  };
}

export async function* iterateGeonamesSourceLines(
  filePath: string
): AsyncGenerator<LineRecord> {
  if (filePath.toLowerCase().endsWith(".zip")) {
    const archiveBytes = await fs.readFile(filePath);
    const archiveEntries = unzipSync(new Uint8Array(archiveBytes));
    const entryName = Object.keys(archiveEntries).find((candidate) =>
      candidate.toLowerCase().endsWith("us.txt")
    );

    if (!entryName) {
      throw new Error("GeoNames source archive does not contain US.txt.");
    }

    const text = new TextDecoder("utf8").decode(archiveEntries[entryName]);
    const lines = text.split(/\r?\n/);
    let lineNumber = 0;
    for (const line of lines) {
      lineNumber += 1;
      yield { lineNumber, line };
    }
    return;
  }

  const sourceStream = createReadStream(filePath, { encoding: "utf8" });
  for await (const lineRecord of readLines(sourceStream)) {
    yield lineRecord;
  }
}

async function upsertDimZipRecord(executor: SqlExecutor, record: GeonamesZipRecord): Promise<void> {
  await executor.query(UPSERT_DIM_ZIP_SQL, [
    record.zipCode,
    record.stateCode,
    record.city,
    record.county,
    record.latitude,
    record.longitude,
    record.isNj
  ]);
}

export async function ingestGeonamesLines(
  lines: AsyncIterable<LineRecord>,
  context: Pick<
    IngestionJobContext,
    "executor" | "incrementRowsRead" | "incrementRowsWritten" | "reject"
  >
): Promise<void> {
  for await (const { lineNumber, line } of lines) {
    if (line.trim().length === 0) {
      continue;
    }

    context.incrementRowsRead();
    const parsed = parseGeonamesLine(line);
    if (!parsed.ok) {
      await context.reject({
        lineNumber,
        reason: parsed.reason,
        rawPayload: line
      });
      continue;
    }

    await upsertDimZipRecord(context.executor, parsed.record);
    context.incrementRowsWritten();
  }
}

export async function runGeonamesIngestion(
  executor: SqlExecutor,
  sourceUrl: string
): Promise<IngestionSummary> {
  return runIngestionJob(
    executor,
    {
      sourceName: "geonames",
      sourceUrl,
      advisoryLockKey: GEONAMES_ADVISORY_LOCK_KEY
    },
    {
      execute: async (context) => {
        const lines = iterateGeonamesSourceLines(context.downloadedSource.filePath);
        await ingestGeonamesLines(lines, context);
      }
    }
  );
}
