# Library account storage: server foundation

Status: server and opt-in native client are implemented. The API and client
remain disabled unless `LIBRARY_ACCOUNT_SYNC_ENABLED=1`; enabling the client also
requires a fresh build. No production migration or activation has been executed.
The local client/notice and isolated API flow are verified. Keep the flag absent
until actual OAuth/environment checks and the separately approved migration are
complete. See `library-account-client.md` for current client behavior and limits.

## Scope and protocol

Only the existing `pathfinder.library.v1` format is accepted: engineer/Jira task
drafts, checklists, review status/date, titles, safe internal links and reading
timestamps. PMP, certificate theory, standalone Jira lessons and CS journey/streak
records are excluded. The original browser key, guest behavior and backup format
are unchanged. The server rejects malformed/future fields instead of silently
dropping records through the permissive legacy parser.

- `GET /api/library-study` returns `{ownerId,revision,state}` for the session owner.
- `PUT` requires same-origin JSON, `{baseRevision,requestId,state}`, and a session.
  The `x-library-owner` header must match the current session before any write.
  This is an account-switch precondition, never an owner selector. Responses also
  identify their session owner so late replies can be rejected by the client.
  The request body never supplies the owner ID. Unknown fields are rejected.
- The streamed request limit is 3,000,000 bytes; maximum 200 entries, 6,000 draft
  characters and 30 checklist items per entry. The SQL representation has a
  4,000,000-byte defensive bound to allow JSONB formatting overhead.
- A transaction locks the owner's snapshot row, checks the expected revision and
  writes both the snapshot and receipt. Lock/statement waits are capped at3/10s.
  Stale revisions return409 with the current
  account snapshot, preserving the stored draft. Clients must retain their local
  draft and reconcile explicitly; never adopt the409 response by overwriting it.
- The last64 write IDs are retained for idempotent retries. Reusing a retained ID
  with a different payload is refused. A replay returns both the original
  acknowledged revision and the **current** snapshot; these can differ. Expired
  receipts still cannot overwrite a newer revision because the old base fails.
- Every database query includes the session owner. Tables have default-deny RLS
  and PUBLIC privileges revoked; the trusted server uses the owning DB role.
  This is not a browser-accessible Supabase policy or JWT-to-DB-role mapping.
- Account deletion cascades through the snapshot and write receipts. No notes,
  IDs, payloads, raw exceptions or connection credentials are logged by this API.
  Responses are private/no-store and missing tables fail with503, never DDL.

PGlite tests cover SQL atomicity/rollback, stale writes, retries, ownership,
RLS denial, validation and cascades. The opt-in real-Postgres runner additionally
verifies concurrent first/existing writes, receipt races, owner-row lock isolation
and timeouts in a dedicated local PostgreSQL18.6 cluster with verified TLS.
See `library-postgres-verification.md`. These tests do not prove production
Neon/PgBouncer behavior, Google OAuth or authenticated cross-device restoration.

## Client rollout checks

1. Implemented: explicit open/import/manual upload, included/excluded scope and
   active-scope backup; login alone does not import guest records.
2. Implemented: per-owner working/pending copies, stale-response checks, old-client
   disposal and a distinct unchanged guest key.
3. Implemented: expected revisions, frozen retry IDs/payloads and explicit
   three-way conflict choices with local/remote/comparison-base views.
4. Verified with real API + PGlite and synthetic-auth desktop QA: read → draft →
   save → separate-client/session restore, owner switch and lost-response retry.
   Actual Google OAuth and approved live-environment restoration remain pending.
5. Published after actual humanize-korean review: Korean scope, logout, browser
   retention and server-deletion notices. Server rollout is still disabled.

## Concrete production migration plan (not executed)

Target is the existing Neon database identified by the SHA256 hostname/database
fingerprint `a52c3eed53cc667d` in the private-free read-only readiness report.
The URL/credentials remain in the existing private environment and are never
copied to this document. Reserve0021 for the user's staged seed migration;
this change is **only** `0022_library_study.sql`.

After the client/notice work is ready, request explicit approval for this exact
target and two-table additive migration. Do not run the general migration runner
against all pending files, enable the rollout flag or seed existing tables as
part of this approval.

1. Read-only preflight: verify fingerprint, public-schema CREATE privilege, existing
   auth schema, and that both new tables are absent. Save a schema-only backup to
   a private0600 local file, outside tracked files and user-facing outputs. Since
   the new tables are absent and no existing rows are rewritten, existing account
   data is outside the forward change.
2. Execute only0022 and record its migration name, in one transaction, with
   `lock_timeout='3s'` and `statement_timeout='15s'`. Abort on unexpected tables,
   target mismatch or missing auth FK. Keep the feature flag off.
3. Verify columns, constraints, RLS and FK cascades without inserting production
   test accounts/answers. Actual concurrency/OAuth/write testing requires an
   explicitly separate development database or separately authorized test data.
4. After authorized real-environment validation, enable the flag and verify the
   real opt-in workflow. Flag activation and successful migration are distinct
   steps; neither means account synchronization has already been tested.
5. Rollback first disables the flag and rolls application code back while leaving
   account snapshots intact. Physical table removal is optional. The supplied
   `library-account-empty-rollback.sql` refuses removal if any snapshot exists.
   Once records exist, export only these tables into a private protected backup
   and obtain separate deletion approval before any destructive rollback.

Primary references checked2026-10-28:
[PostgreSQL row locking](https://www.postgresql.org/docs/18/explicit-locking.html#LOCKING-ROWS)
and [RLS owner/default-deny behavior](https://www.postgresql.org/docs/18/ddl-rowsecurity.html).
