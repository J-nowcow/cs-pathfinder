# PostgreSQL transport verification

The application and standalone database scripts use `postgresPoolConfig` from
`src/lib/db/postgres-config.ts`. This applies to the existing PostgreSQL pool
shared with better-auth; guest PGlite behavior is unchanged.

The policy requires a PostgreSQL TCP URL, public-CA certificate validation and
normal hostname validation. Encoded Unix-socket hosts and query-string host
overrides are rejected so the driver cannot skip TLS by using a local socket. URL flags such as `sslmode=disable`, `ssl=no-verify`
and `uselibpqcompat=true` cannot override the explicit TLS options. Custom
certificate file parameters are rejected rather than silently read or ignored.
This configuration targets the project's existing public-CA Neon connection;
private-CA or mutual-TLS deployments require a separate reviewed configuration.
The connection wait is capped at 10 seconds. Existing pool size (5) and idle
timeout (30 seconds) are retained. Do not log the returned configuration: it
contains credentials.

The scripts still perform their original operations. Centralizing their TLS
configuration does not authorize executing migrations, seeding, embeddings or
content repair against production. Follow the explicit production-change
approval and backup/rollback procedure first.

## Evidence and limits

- `tests/db/postgres-tls.test.ts` generates disposable test certificates in a
  temporary directory. It uses the actual installed `pg` client against a
  minimal loopback PostgreSQL SSL/startup server, checking rejection of an
  untrusted chain and a trusted certificate for the wrong hostname, and success
  with a trusted matching certificate. OpenSSL is required for these fixtures;
  temporary keys are removed after the tests.
- The actual application `getPool()` path connected to the existing database on
  2026-10-28 with an authorized TLSv1.3 connection. It ran only `BEGIN READ ONLY`,
  a schema/settings query and `ROLLBACK`; no migrations, seed or data writes.
- The local TLS server does not validate PostgreSQL authentication or SQL
  concurrency. The read-only probe does not validate Google OAuth, write paths,
  every deployment environment or new account synchronization.

## Primary references

Checked 2026-10-28 against the installed `pg`/`pg-connection-string` implementation:

- [node-postgres SSL configuration](https://node-postgres.com/features/ssl):
  URL SSL parameters replace an explicitly supplied SSL object.
- [Neon secure connections](https://neon.com/docs/connect/connect-securely):
  Neon requires TLS and recommends full verification.

No TLS environment flag, trust store, proxy, VPN, network route or user
certificate configuration is changed by this implementation.
