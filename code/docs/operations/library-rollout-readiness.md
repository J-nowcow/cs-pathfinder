# Library account rollout readiness

Current status (2026-10-28): the user-approved additive migration0022 was applied
once at2026-10-27T21:52:19Z to target fingerprint `a52c3eed53cc667d` and independently
checked read-only. Account rollout remains disabled. No repeat migration, seed,
production test records or activation is part of this change. Real Google OAuth
and authenticated cross-session save/restore remain unverified.

## Build gate

`npm run build` runs `verify:library-rollout` before Next.js. When
`LIBRARY_ACCOUNT_SYNC_ENABLED` is absent or not exactly `1`, the gate returns
without parsing credentials or connecting to any database. Existing native
reading and browser-local notes therefore do not acquire a readiness query.

When the flag is `1`, the injected build environment must include:

- `LIBRARY_ACCOUNT_EXPECTED_DB`: the approved nonsecret host/database fingerprint.
  For the approved production target this is `a52c3eed53cc667d`.
- `LIBRARY_ACCOUNT_EXPECTED_ORIGIN`: the exact HTTPS application origin. For
  production this is `https://cs-pathfinder.vercel.app`.
- Existing `DATABASE_URL`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`,
  `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`. Never copy their values into reports.

The target is compared before any connection; password rotation does not change
the fingerprint. This fingerprint identifies hostname/database, not a cryptographic
attestation of the database operator or its contents. The auth URL must match the
pinned HTTPS origin, with no credentials, callback path, query or fragment.
Nonempty OAuth settings are necessary but do not prove a successful Google login.

The connection uses the existing public-CA TLS configuration and checks authorized
TLS. A `BEGIN READ ONLY` transaction with3s lock and10s statement timeouts checks
two tables, nine column shapes, owner-only grants, enabled RLS, primary keys,
cascade foreign keys, constraint count, receipt revision index and the0022 log.
This is a readiness shape check, not full DDL attestation. It reads metadata and
one migration-log count; it never reads account/answer rows, migrates, seeds,
inserts users or requires the tables to be empty. It always rolls back/releases
the connection. Failures expose only bounded error codes, not raw errors or URLs.
The check runs once per enabled build, not on each lesson visit or API request.

Use the standard `npm run build` deployment path. Calling `next build` directly
bypasses this script. The gate intentionally reads only injected process variables;
it does not load private env files or prove settings introduced after the build.
Vercel environment changes affect new deployments. A runtime-only setting change
or a later external schema change still requires operator validation. This gate
is a safeguard, not authority to enable rollout or run a migration.

## Why check inside the build

Vercel project/environment names were readable through the authorized CLI, but
secret values were not returned by the metadata API. An env-run attempt from the
original checkout was contaminated by its existing local env file and was rejected
as evidence; an env-free attempt did not yield the required secret values. Neither
proves missing production configuration. No secret file was pulled or copied.
The enabled build can validate its actual injected settings without exporting them.

Keep the production flag off until actual Google login is confirmed and the
read-only target/schema check passes in that deployment environment. Then verify
the authorized opt-in workflow with user-owned records. A successful build alone
does not prove OAuth, production write semantics or cross-device restoration.
Disable the flag first on rollback and preserve account rows; destructive table
rollback remains a separate approval and backup operation.

## Validation

Configuration/CLI tests cover disabled network skip, pinned target changes,
credential rotation, HTTPS origin and required settings, and sanitized failures.
The owned disposable TLS/SCRAM PostgreSQL runner exercises the real inspector,
then independently introduces a PUBLIC grant, disabled RLS, missing index and
missing migration log. Each is refused, restored and rechecked, with no snapshot
or receipt rows written by the gate. Fault injection never targets production.
The runner also retains its existing concurrency, replay, lock timeout, cascade,
restricted migration and private archive/restore checks. PGlite/unit tests alone
are not evidence of real PostgreSQL concurrency or production OAuth.

Primary references checked2026-10-28:
- [Vercel environment variables](https://vercel.com/docs/environment-variables)
  describes build/runtime access and deployment-scoped environment changes.
- [PostgreSQL read-only transactions](https://www.postgresql.org/docs/18/sql-set-transaction.html)
  defines the transaction mode used by this inspector.
