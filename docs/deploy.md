# Deploy

You need a Cloudflare account. The free plan is enough.

## Release

A push to `main` runs
[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml). It runs
`bun run check`, applies the pending D1 migrations to the remote database, then
deploys the Worker. A failed check or migration stops the run before the next
step. Two pushes never deploy at once, and a running deploy is never cancelled.

Set this once, in the repository's Settings, under Secrets and variables, then
Actions:

| Kind     | Name                    | Value                                        |
| -------- | ----------------------- | -------------------------------------------- |
| Secret   | `CLOUDFLARE_API_TOKEN`  | An account API token, described below.       |
| Variable | `CLOUDFLARE_ACCOUNT_ID` | The account id, on the Workers & Pages page. |
| Variable | `D1_DATABASE_ID`        | The `database_id` that `d1 create` printed.  |

Create the token on the Account API tokens page of the Cloudflare dashboard:
Create Token, then a custom token. Give it two permissions, both on the account:
Workers Scripts Edit and D1 Edit. Limit the resources to your account.

`wrangler.jsonc` keeps the placeholder `REPLACE_WITH_DATABASE_ID`. The workflow
runs [`scripts/set-database-id.ts`](../scripts/set-database-id.ts) to put
`D1_DATABASE_ID` in its own checkout. It fails when the variable is empty.

Before the migration, the step "Print the rollback bookmark" writes the output
of `wrangler d1 time-travel info` to the log. Its bookmark is the database as it
was before the release. Restore the database with it. Redeploy the earlier
commit to roll the Worker back:

```sh
bunx wrangler d1 time-travel restore bitacora --bookmark=<bookmark>
```

## First-time setup

Run these steps by hand once, before the first push to `main` can deploy.

1. Sign in with Wrangler. It opens a browser to authorize your account:

   ```sh
   bunx wrangler login
   ```

2. Create the database. Set the `database_id` it prints as the `D1_DATABASE_ID`
   variable. To run the next step from your machine, also put it in
   `wrangler.jsonc` and do not commit that change:

   ```sh
   bunx wrangler d1 create bitacora
   ```

3. Apply the migrations and deploy. The first deploy on an account asks you to
   register the workers.dev `<subdomain>`, which the workflow cannot answer:

   ```sh
   bun run db:migrate:remote
   bun run deploy
   ```

4. Set the signing key. The command asks for the value (see
   [Secrets](../README.md#secrets)):

   ```sh
   bunx wrangler secret put SESSION_SECRET
   ```

5. Claim the first admin. The migration creates the account without an email or
   a password, so nobody can sign in until you do this. The command asks for the
   password twice:

   ```sh
   bun run claim-admin -- --remote --email you@example.com --name "Your Name"
   ```

   It works once. When the account already has a password it prints "The first
   admin is already claimed. Nothing changed." and exits with 1. Without
   `--remote` it claims the account in the local database.

`workers_dev` is on, so the Worker answers at
`https://bitacora.<subdomain>.workers.dev`. Wrangler prints the address after
the deploy. Sign in there with the email and password you chose, then invite the
others from Ajustes. That address is the `BITACORA_URL` of the script.

Deploying over a database that already holds cards keeps them, and the report
link, under the first admin. Run steps 3 to 5. If the Worker still has an
`OWNER_PASSWORD_HASH` secret, delete it with
`bunx wrangler secret delete OWNER_PASSWORD_HASH`.
