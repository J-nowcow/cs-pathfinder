# Private sync admission before corpus seeding

`GET /api/journey`, `POST /api/journey/merge` and `POST /api/streak/merge`
now resolve the existing server session before `ensureSeeded()`. An expired or
absent session returns the same private, no-store 401 without seeding public
content, parsing the request body or accessing private records. A public corpus
outage therefore cannot turn an unauthenticated request into a seed failure.
Session lookup failures still propagate. Authenticated requests still seed before
reading or merging data; their schema, server-owned labels, owner selection,
additive retry semantics and response bytes are unchanged. No auth implementation,
cookie policy, rollout flag, public cache or database schema changes are included.

## Local comparison

At commit `0670ef7`, each of the three routes was measured once per condition
using ephemeral PGlite and a synthetic null session, then again after the change:

| Condition | Before queries | After queries | Before write statements | After write statements |
| --- | ---: | ---: | ---: | ---: |
| Initialized empty schema, first request | 2491 | 0 | 2488 | 0 |
| Populated database, seed promise reset | 361 | 0 | 358 | 0 |

Counts cover application corpus queries only. Actual better-auth session queries,
schema setup, module loading and process startup are excluded. A seed-promise
reset is not an actual process cold start. SQL statement counts are not changed-row
counts. There is no measured production CPU, Neon CU, connection, billing or
latency reduction. Warm processes already holding a resolved seed promise do not
have this corpus-query cost. Normal guests do not invoke these sync APIs from
`SyncAgent`; expired sessions, stale tabs and direct unauthenticated requests are
the affected admission path.

Run the regression fixture with explicit local DB isolation:

```sh
USE_REAL_DB=0 DATABASE_URL= npm test -- --run tests/api/private-sync-cost.test.ts tests/api/private-sync-order.test.ts
```

`PRIVATE_SYNC_COST_REPORT=/absolute/path/report.json` optionally exports the six
local samples from the cost fixture. Each test rejects a nonempty database URL.
The order fixture checks denied sessions during a corpus outage, auth failures,
seed failure followed by a successful retry, and server session ownership after
switching accounts. Existing PGlite route/storage tests cover the actual read,
merge, retry, server labels and owner separation contracts.

## Session-consumer investigation

The installed better-auth 1.6.26 client creates one session atom per `authClient`.
Its refresh manager defaults to no interval polling and keeps focus/online and
broadcast refreshes. A local desktop `/me` load with intercepted anonymous session
responses measured one initial request across `SyncAgent`, `AuthMenu` and
`AuthCard`, one first visibility refresh and zero additional requests for five
immediate visibility events. This is a mocked-network observation, not OAuth or
server-query verification; no client refresh policy was changed. The disabled
library rollout does not mount the enabled account provider.

Sources: [Better Auth session management](https://better-auth.com/docs/concepts/session-management)
and installed `better-auth/dist/client/{config,session-atom,session-refresh}.mjs`.
The official documentation describes server session verification and cookie cache
revocation tradeoffs; it is not evidence of this project's provider usage.
