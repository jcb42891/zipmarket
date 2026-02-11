const HELP_TEXT = `
ZipMarket ETL CLI

Usage:
  npm run etl -- --help
  npm run etl -- geonames
  npm run etl -- redfin
  npm run etl -- run-all

Commands:
  geonames   Placeholder command for GeoNames ZIP metadata ingest
  redfin     Placeholder command for Redfin ZIP market ingest
  run-all    Placeholder command to execute all ETL jobs in sequence
`;

function printHelp(): void {
  console.log(HELP_TEXT.trim());
}

async function run(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);

  if (!command || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    return;
  }

  switch (command) {
    case "geonames":
      console.log("[etl] geonames ingest scaffold is ready.");
      return;
    case "redfin":
      console.log("[etl] redfin ingest scaffold is ready.");
      return;
    case "run-all":
      console.log("[etl] run-all scaffold is ready.");
      return;
    default:
      console.error(`[etl] Unknown command: ${command}`);
      printHelp();
      process.exitCode = 1;
  }
}

void run();

