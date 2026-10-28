# Seed alias roundtrip cost

Every process's first valid CS request calls `ensureSeeded`. That path checks authored nodes, suggestions, aliases and relations before serving the requested node. Alias registration previously sent one `INSERT ... ON CONFLICT DO NOTHING` for each alias, even when it already existed. The initialized local catalogue has 355 nodes and 430 aliases, so 430 roundtrips registered unchanged aliases on each process-seed reset.

`seedExampleNodes` now collects those alias candidates while preserving the original node order, then inserts them in bounded batches of 256 after the nodes exist. `insertSeedAliases` keeps the first candidate for each hash and retains the same `(normalizer_version, normalized_hash) DO NOTHING` conflict rule. Its parallel hash/UUID arrays come from the same batch. Existing aliases keep their mapping; changing a normalizer version creates a separate key space. Node IDs, number allocation, body/suggestion refresh, tags, relation handling and process seed-promise behavior are unchanged.

This is not the separate seed-marker/recheck candidate from the original checkout. No completion marker, seed TTL, migration or background operation is introduced. Failed seed attempts may leave completed alias batches; a retry fills the remaining aliases without overwriting the completed mappings. The entire seed remains non-transactional, as before. A foreign-key failure rolls back its batch, not previously completed batches.

## Isolated comparison

```sh
NODE_ENV=test USE_REAL_DB=0 DATABASE_URL= NODE_TLS_REJECT_UNAUTHORIZED=1 \
  node --import tsx scripts/measure-seed-startup.ts /absolute/report.json
```

The script refuses a network database URL and never loads env files. Schema initialization and module loading are excluded. It calls the real valid-node API with ephemeral PGlite, once on an empty initialized database, three times after resetting only the process seed promise on populated data, then once without resetting that promise.

| Valid-node API fixture | Previous queries | Batched queries | Alias INSERT statements |
| --- | ---: | ---: | ---: |
| Empty initialized DB, first seed | 2923 | 2495 | 430 to 2 |
| Populated DB, process seed promise reset, each of 3 samples | 793 | 365 | 430 to 2 |
| Populated DB, same process seed promise | 4 | 4 | 0 to 0 |

Both variants returned 200 and produced the same canonical public-data checksum over 355 nodes, 430 aliases, 1775 suggestions and 474 relations. The comparison includes the node API's reads and counts INSERT statements, not rows changed. It does not measure actual process cold-start CPU, connection establishment, production latency, Neon compute usage or billing. A new process still performs node checks and a real DB connection/request can still wake a sleeping database.

The owned PostgreSQL verifier uses the real alias-table DDL in a dedicated database with TLS/SCRAM. It compares all mappings against individual INSERTs, checks first-input/existing-map precedence, verifies that replay does not rewrite row tuples, recovers a failed second batch, separates normalizer versions, checks foreign-key batch atomicity, and waits for an actual transaction-ID lock before releasing a concurrent conflicting insert. This is a synthetic local test, not application-wide distributed seeding or Neon/PgBouncer/OAuth verification.

The original checkout's six staged DB files and the marker candidate stay untouched. No production seed, load test, index or schema operation is manually executed by these checks. The previous marker candidate's historical billing comments are not used as measurements.

References: [PostgreSQL INSERT and ON CONFLICT](https://www.postgresql.org/docs/18/sql-insert.html), [parallel array unnest](https://www.postgresql.org/docs/18/functions-array.html).
