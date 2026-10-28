# Avoid unchanged relation rewrites

## Observed path and change

Several CS entry points call `ensureSeeded`, including map, tree/node APIs,
journey/streak merges and public corpus routes. Its process-local promise prevents
repeat work within that instance, but cold instances still reach
`seedExampleNodes` -> `seedRelations` -> `saveRelations`. The relation UPSERT was
already one bulk query. Its conflict branch nevertheless performed an UPDATE even
when the stored votes, reason and provenance would remain identical.

The conflict branch now updates only when incoming votes are higher or incoming
human provenance can promote a non-human row. The existing rules remain: maximum
votes, reason from strictly higher votes, human provenance is never downgraded,
and deactivated relations stay inactive. Equal-score new reason text still does
not replace the stored reason. Deduplication, self-edge exclusion, inserts,
identifiers and all callers keep their behavior. An optional trusted transaction
adapter lets the owned PostgreSQL fixture exercise the actual production function;
normal callers still use the same shared application DB.

This is independent of the original user's staged seed fingerprint work. That
six-file original remains untouched. The broader marker/recheck candidate is not
activated, and no seed-state migration, marker write, full production seed or
schema/index change is executed for this optimization.

## Controlled measurements

Owned disposable PostgreSQL18.6, verified TLS/SCRAM, synthetic401 nodes and400
relations, five warm repeated batches per variant. The A/B baseline is the exact
previous UPSERT with only the new condition removed. Its SQL was compared byte
for byte with the prior feature source at9367f40; SHA256:
`74f276103556ce97be5c9c82b38bc2f65cfc0776d811ad1ae5fcffbdb8f3435f`.
Both variants insert the initial400 rows before warm timing. Per-round `ctid`
comparisons count changed row versions; they are not production usage counters.

| Metric | Before | After |
| --- | ---: | ---: |
| Unchanged row versions rewritten across5 rounds | 2,000 | 0 |
| UPSERT calls across5 rounds | 5 | 5 |
| Local warm roundtrip median, milliseconds | 3.390 | 1.203 |
| Final visible relation data | Same | Same |

The timing is a five-sample local diagnostic, not a production CPU/CU or billing
measurement. Setup, TLS establishment and initial inserts are outside warm timing.
The optimized call includes its normal JS deduplication work; this is not a pure
server CPU profile. Queries and conflict row locking still occur, so zero row
updates does not mean zero WAL, zero connections or no DB wakeups. No monthly
savings, traffic capacity or zero-cost guarantee is inferred.

Concurrent higher-vote and human-promotion requests retain both outcomes and
preserve deactivation; replaying the weaker already-human judgment does not
rewrite the row. The existing15 PostgreSQL security/migration/concurrency checks
remain green, with this cost check bringing the runner to16 checks. The fixture
stops/removes its owned cluster and never reads application env/private credentials.

## Validation and release boundary

Three new PGlite physical-version regressions fail before the change and pass
afterward. Five focused files/36 tests, then the broader229-file/1,954-test suite,
typecheck and production build pass. The backend shared path justified the full
suite; no new UI or study content was introduced. Original six staged DB files,
Korean strings, guest/private records, backup formats and existing learning IDs
are preserved. The library account rollout remains off and actual OAuth/restore
verification is still pending. Approved0022 is already applied and not rerun.

Next work should measure total cold-process seed query count and review static/
cache boundaries and duplicate requests. This patch deliberately does not claim
that repeated cold-start seeding or Neon idle wakeups have been eliminated.

Primary source checked2026-10-28:
[PostgreSQL18 INSERT / ON CONFLICT](https://www.postgresql.org/docs/18/sql-insert.html)
explains conditional updates and the row locks that remain when the condition
refuses an UPDATE.
