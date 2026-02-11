export const DEFAULT_LOCAL_DATABASE_URL =
  "postgresql://zipmarket:zipmarket@127.0.0.1:5433/zipmarket";

export function resolveDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const configuredValue = env.DATABASE_URL?.trim();

  if (configuredValue) {
    return configuredValue;
  }

  return DEFAULT_LOCAL_DATABASE_URL;
}
