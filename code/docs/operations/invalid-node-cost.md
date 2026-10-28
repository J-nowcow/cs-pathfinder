# Reject malformed node keys before seeding

The node loader already refused keys outside the existing positive1–9 digit
number or UUID shapes. However, `GET /api/node/[id]`, reading-page metadata and
`/q/[nodeId]` called `ensureSeeded` before reaching that check. An impossible
address could therefore perform cold-instance seed work before returning404.
The shared-tree slug loader already validated its slug before seeding.

Export the existing node-key predicate and use it before seeding at these public
entry points. The loader reuses that same predicate. Reading-page metadata keeps
its existing missing-title fallback, and the page uses its existing `notFound`
boundary. The API keeps the same404 JSON. No redirect, accepted key shape, normal
lookup, ready-only filtering, related data, quota/auth/cache rule or Korean string
changes. Valid number and UUID links still follow the normal path; a syntactically
valid missing key can still reach the DB. This is not a general rate limiter or
complete bot/DoS defense.

## Before and after

Same isolated PGlite fixture and real API handler: populate the DB first, reset
only the process's seed promise, then request `not-a-node`. DB setup/migrations
are excluded from the query spy. This simulates a cold seed cache against an
already populated database, not full process/module initialization or real Neon.

| Handler metric for that request | Before | After |
| --- | ---: | ---: |
| DB query calls | 789 | 0 |
| INSERT statements attempted | 786 | 0 |
| SELECT statements | 3 | 0 |
| API response | 404 | 404 |

INSERT calls include UPSERT/conflict checks; they are not786 changed rows. The
prior conditional relation-update optimization remains. These counts do not
measure Vercel CPU, Neon CU-hours, billed cost or actual malformed-traffic volume.
Warm instances already holding a resolved seed promise had less overhead before;
this comparison deliberately resets that promise.

## Validation

The new zero-query assertion fails before the change and passes afterward. Seven
focused files/36 tests include API payload/privacy/cache regressions, number/UUID
lookup, reading history/sync/backlinks and12 metadata/page key cases. Typecheck
and production build pass. No SQL or transaction semantics change, so the previous
229-file/1,954-test and16 owned PostgreSQL checks remain historical evidence;
they are not relabeled as rerun for this patch.

Desktop Chrome verifies the malformed API JSON404 and the page's existing404
boundary/noindex, retaining separate library/PMP/certificate keys. Normal number
and UUID API lookups are checked only in local PGlite. No valid production node
lookup or manual seed is used for verification. Browser auth transport, if mounted,
is intercepted as anonymous; this is not real OAuth validation. No new cache,
private storage format, schema/index or account-rollout activation is introduced.

Reference checked2026-10-28:
[Next.js notFound](https://nextjs.org/docs/app/api-reference/functions/not-found)
documents route termination and noindex. Current docs identify16.4.3; this app
remains on16.2.6 and was verified with its installed runtime. A not-found UI can
carry200 after streaming starts; the observed status is recorded separately.
