# Restricted library migration package

Status: tooling is prepared; production execution needs explicit human approval.
The command does not grant itself permission. Never infer approval from an earlier
push/deploy request or from possession of `--approve-target`. Keep account rollout
off throughout this migration-only step. No general migration runner, seed,
0021 changes, existing-row updates or production test accounts are included.

## Prepare (read only)

Run from `code`, using absolute paths. The private parent must be0700, outside the
repository and user-facing outputs. The environment file stays in its existing
private location; only its single-line DATABASE_URL value is read in memory.
Nothing is loaded into application/test environment variables. Shell interpolation
in the file is unsupported. Connection errors and dump diagnostics are not printed.

```
npm run db:library -- prepare \
  --env-file ABS_PRIVATE_ENV_FILE \
  --target EXPECTED_16_HEX_FINGERPRINT \
  --bin-dir ABS_POSTGRES_BIN_DIRECTORY \
  --private-dir ABS_PROTECTED_PARENT
```

The fingerprint is SHA256(hostname + database URL pathname), truncated to16hex.
A second full hash binds host, port, database and login role, allowing password
rotation without quietly changing the target. The SQL hash is pinned in source.
The plan expires after24hours, and is not a permission receipt.

Preparation verifies public CREATE, existing auth id text primary key and the
migration-log name primary key, absent library tables and no0022 log record. It
uses `BEGIN READ ONLY` and rolls back. Relevant auth/log columns and constraints
are hashed before and after the backup; apply rechecks that hash. This does not
serialize unrelated external DDL or prove all existing schema is unchanged.

A fresh0700 directory contains a schema-only custom archive and plan, each0600.
`pg_dump` uses verified TLS with hostname validation, a per-process copy of Node's
public CA roots, no connection URL/password CLI argument, and no inherited PG*
configuration. It uses its own read-only snapshot transaction, a3s table-lock wait
and60s process bound. No TLS verification, system trust or network routing is
changed. Dump warnings fail preparation and no plan is written. An archive TOC
check refuses table/sequence/blob data entries. Relevant schema is checked again.

This is a **public-schema structural snapshot**, excluding owners, privileges,
other schemas, global roles and row data. It is not a full database disaster
recovery backup, and may need external extensions/dependencies for restoration.
The disposable fixture verifies schema restore and absence of its synthetic row;
the production archive is not automatically restored or executed anywhere.
Schema/function definitions may still be private: never attach the archive or
plan to Git, a PR, user-facing outputs, a browser, or another service.

## Apply only after specific execution approval

Review the current target, plan/SQL/backup hashes, read-only preflight, test report
and rollback scope with the human first. Then use the same private environment:

```
npm run db:library -- apply \
  --env-file ABS_PRIVATE_ENV_FILE \
  --target APPROVED_16_HEX_FINGERPRINT \
  --plan ABS_PREPARED_PLAN_JSON \
  --approve-target APPROVED_16_HEX_FINGERPRINT
```

Only0022 and its migration-log insert run in one transaction. A transaction-scoped
advisory lock serializes this command. Lock/statement timeouts are3/15s. Rechecks
refuse target/file/schema changes, previously created tables or an applied log.
Columns, types, nullability, constraints, cascade FKs, index, RLS and owner-only
privileges are checked before commit. Unexpected inherited grants cause rollback.
No test rows are written. An uncertain/lost commit response needs a read-only
operator check; rerunning is refused once tables/log exist, not blindly replayed.

Rollback first leaves the account flag off and preserves snapshots. The reviewed
`library-account-empty-rollback.sql` is a separately invoked empty-table-only
physical rollback; it refuses when snapshots exist. Once account data exists,
obtain a protected data backup and separate deletion approval. Never restore the
whole structural snapshot over the running database as an automatic rollback.

## Validation and limits

`npm run verify:library-postgres` now also uses this exact module and pg_dump on
owned disposable TLS/SCRAM PostgreSQL databases. It rejects changed host/database,
SQL/backup/expired plans and schema drift; a forced migration-log trigger failure
rolls DDL back; two concurrent applies produce one success/one refusal; log/empty
new tables and empty-only rollback are checked. The archive restores into a second
owned disposable database with zero synthetic user rows. The fixture's explicit
`pg_restore --clean` is limited to that freshly created disposable database.
Plan-only unit tests also check port/role changes, credential rotation, future/
invalid clocks, versions and tampering with both SQL and its plan hash.

These checks do not prove production Neon/PgBouncer transaction behavior, Google
OAuth or an authenticated cross-device account workflow. Application/runtime UI
has not changed and the production flag remains off.

Primary references checked2026-10-28:
- [PostgreSQL18 pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html)
- [libpq verify-full](https://www.postgresql.org/docs/18/libpq-ssl.html)
- [pg_dump18 read-only snapshot source](https://github.com/postgres/postgres/blob/REL_18_STABLE/src/bin/pg_dump/pg_dump.c)
