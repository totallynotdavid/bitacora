/** The account the migration creates. Its email and password are unset until `claim-admin` sets them. */
export const FIRST_ADMIN_ID = "00000000-0000-4000-8000-000000000001";

const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;

/**
 * The statement that claims the first admin. It changes nothing once the
 * account has a password, so running it twice cannot take the account over.
 * It returns the claimed row, so a caller can tell a claim from a no-op.
 */
export function claimAdminSql(claim: { email: string; name: string; passwordHash: string }): string {
  return (
    `UPDATE users SET email = ${quote(claim.email.trim().toLowerCase())}, name = ${quote(claim.name)}, ` +
    `password_hash = ${quote(claim.passwordHash)} ` +
    `WHERE id = ${quote(FIRST_ADMIN_ID)} AND password_hash IS NULL RETURNING id;`
  );
}
