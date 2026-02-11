import readline from "node:readline";

export interface LineRecord {
  lineNumber: number;
  line: string;
}

export async function* readLines(input: NodeJS.ReadableStream): AsyncGenerator<LineRecord> {
  const lineReader = readline.createInterface({
    input,
    crlfDelay: Infinity
  });

  let lineNumber = 0;
  try {
    for await (const line of lineReader) {
      lineNumber += 1;
      yield { lineNumber, line };
    }
  } finally {
    lineReader.close();
  }
}
