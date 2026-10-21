export const PLACEHOLDER = "REPLACE_WITH_DATABASE_ID";

export function withDatabaseId(config: string, databaseId: string | undefined): string {
  const id = databaseId?.trim();
  if (!id) throw new Error("D1_DATABASE_ID is empty. Set it as a repository variable.");
  if (!config.includes(PLACEHOLDER)) throw new Error(`wrangler.jsonc has no ${PLACEHOLDER} to replace.`);
  return config.replaceAll(PLACEHOLDER, () => id);
}
