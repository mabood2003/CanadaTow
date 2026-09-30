export const databaseUrl = process.env.DATABASE_URL ?? "";

export function hasDatabaseConfig() {
  return Boolean(databaseUrl);
}
