# Real PostgreSQL concurrency verification

`scripts/verify-library-postgres.ts` is an opt-in destructive test of a **new,
owned, loopback-only cluster**, never an existing database. It accepts binary,
scratch and report paths only. It does not accept connection URLs or read app
env files, `DATABASE_URL` or `PG*` connection settings. Every connection sets its
host/port/database/user/password/TLS configuration explicitly, and the runner
checks the server's data directory and TCP endpoint before creating fixtures.

Example from `code/`, using separately installed PostgreSQL18 binaries:

```sh
NODE_TLS_REJECT_UNAUTHORIZED=1 npm run verify:library-postgres -- \
  --bin-dir /opt/homebrew/opt/postgresql@18/bin \
  --work-dir /absolute/task/work/postgres-private \
  --report /absolute/task/work/postgres-concurrency-report.json
```

All three paths are mandatory and absolute. The binary directory must contain
`initdb`, `pg_ctl`, `pg_dump` and `pg_restore`; OpenSSL must be available. The runner creates a unique
private directory underneath the scratch parent. It never starts a system
service or uses a pre-existing cluster. On completion it stops only the cluster
at that unique data directory, then removes its synthetic data, generated
password and CA/private keys. A failed stop preserves those files for recovery
instead of deleting a potentially active cluster. The report contains pass/fail
labels, timings and server/TLS versions, never credentials or answer contents.

The new cluster disables Unix sockets, listens only on127.0.0.1 at a fresh port,
requires host TLS and SCRAM-SHA-256, and rejects plaintext/local-socket access.
Its short-lived CA is passed only to test connections; certificate validation
and hostname checks remain enabled. No system trust store, production connection
helper, VPN, routing or proxy settings are modified. Tests explicitly confirm
that an untrusted CA, wrong hostname and wrong password fail.

The application test role is neither superuser nor BYPASSRLS. It owns a minimal
synthetic `user(id)` table and the exact0022 migration's two tables. This models
the new migration's FK/owner boundary, not the complete better-auth schema. The
actual `writeLibraryForUser`/`loadLibraryForUser` functions receive an explicit
multi-connection `Db` adapter; their fallback application connection is unused.

The runner also verifies the guarded migration package and a schema-only archive
restore in separate owned disposable databases. See
[library-migration-package.md](library-migration-package.md). The expanded run has
14 checks; the original13-check result below remains a dated baseline.

## Checked behavior

- Eight concurrent first writes: exactly one revision1 and one receipt; seven
  stale writers receive conflicts.
- Eight writers against an existing revision: exactly one advances that revision.
- Eight identical retries: one commit, seven receipt replays and one write ID.
- Concurrent reuse of one ID with different content: one accepted, one refused.
- An observed row-lock waiter for one owner does not prevent a different owner
  from committing. The test checks `pg_stat_activity`, not just Promise ordering.
- The application's three-second lock timeout produces SQLSTATE55P03 and leaves
  the original snapshot unchanged.
- A forced receipt insertion failure rolls back the first snapshot as well.
- PUBLIC privileges remain revoked; even an explicitly granted non-owner role
  sees no records and cannot insert because RLS has no accepting policy.
- Reapplying0022 preserves existing rows. The supplied rollback refuses nonempty
  tables; deletion cascades and empty-only rollback/reapply succeed.

The first checked run used PostgreSQL18.6 on local macOS arm64, eight distinct
transaction backends and verified TLSv1.3. All13 checks passed; the observed lock
timeout was3004ms. The process and private fixtures were cleaned up. Re-run and
read the new report before making claims about a changed implementation.

This closes the local real-Postgres locking gap left by PGlite. It does not prove
Neon/PgBouncer-specific operation, production load, Google OAuth, authenticated
cross-device behavior or authorized production migration. The production rollout
remains disabled. Follow `library-account-storage.md` for the separate target,
backup, rollback and explicit execution-approval requirements.

Official sources checked2026-10-28:
[PostgreSQL18 SSL](https://www.postgresql.org/docs/18/ssl-tcp.html),
[row locking](https://www.postgresql.org/docs/18/explicit-locking.html#LOCKING-ROWS),
[hostssl authentication](https://www.postgresql.org/docs/18/auth-pg-hba-conf.html),
[initdb](https://www.postgresql.org/docs/18/app-initdb.html) and
[pg_ctl](https://www.postgresql.org/docs/18/app-pg-ctl.html).
