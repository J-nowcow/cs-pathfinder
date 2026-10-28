# Public reads during server rendering

The dynamic question and shared-tree pages previously loaded the same public snapshot separately in `generateMetadata` and in the page body. Each loader makes two queries, so the pair made four queries after seeding. Both callers now use one module-level React `cache` wrapper with the same primitive address argument. A request that renders both consumers reuses the public snapshot and makes two snapshot queries.

The wrappers validate addresses before `ensureSeeded`. Question metadata still reads only the base node and suggestions; related questions are loaded by the page body. Quota headers/reads, voter cookies/reads, and scheduled view increments stay outside the wrappers. The pages retain `force-dynamic`; there is no persistent data cache, public response cache, session cache, TTL, or background refresh. The next server request reads the database again, including the current Asia/Seoul publication date.

## Verification

Run only with an empty network database URL:

```sh
NODE_ENV=test USE_REAL_DB=0 DATABASE_URL= NODE_TLS_REJECT_UNAUTHORIZED=1 \
  node --conditions=react-server --import tsx scripts/verify-public-render-reads.ts /absolute/report.json
```

The verifier refuses other database settings, never loads env files, and creates ephemeral PGlite fixtures. It runs the installed React server renderer from Next's compiled dependencies, rather than mocking React's cache dispatcher. That renderer import is test-only and must be rechecked when upgrading Next/React.

One deterministic, warm-seed query-count sample per variant showed:

| Public snapshot consumers | Before | After |
| --- | ---: | ---: |
| Question metadata + body | 4 | 2 |
| Tree metadata + body | 4 | 2 |

The verifier compares returned data, separates distinct keys, checks zero queries for malformed addresses, observes changed node/tree values on the next request, verifies a consistent snapshot within one request, retries transient failures in the next request, and makes a future daily tree visible in the next request at Asia/Seoul midnight. Separate page tests change the request IP and voter cookie to check that private quota/vote state is not shared. Metadata does not perform those private reads or schedule view writes.

These counts exclude database setup/seeding, related-question reads and private quota/vote reads. They are not measurements of complete request latency, production CPU, billed compute, connection counts, or monthly savings. PGlite does not validate PostgreSQL concurrency or Google OAuth. No production benchmark, manual seed, schema migration, or account-sync activation is included.

## References

- [Next generateMetadata memoization](https://nextjs.org/docs/app/api-reference/functions/generate-metadata): React cache can share direct database reads between metadata and server components.
- [React cache](https://react.dev/reference/react/cache): the memoized results and errors are scoped to each server request; the wrapper must be shared by its callers.

The implementation and verifier were checked with installed Next16.2.6 and React19.2.4. A single page snapshot is not a transaction over its separately loaded related/private data; the previous code did not provide that guarantee either.
