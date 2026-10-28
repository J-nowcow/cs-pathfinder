# Journey synchronization lifetime

Three delayed-response regressions were reproduced against the previous client:
an account B invocation returned account A's global in-flight promise; a local
journey created during a pending response disappeared; and a locally recorded
streak item disappeared during a pending streak response. The scheduled refactor
therefore includes a bounded correctness-recovery exception before alternation.

Each in-flight job now carries its owner, identity and AbortController. Same-owner
overlap shares the promise. A new owner cancels the prior job. The site effect
returns that job's disposer on owner changes, logout or unmount. Old cancellation
and finally handlers cannot clear a newer job, including A-to-B-to-A transitions.
Every async response boundary rechecks job identity before publishing storage,
events, a following request or the completion marker; abort is not the sole guard.

The outgoing snapshot retains the existing sanitized forest and wire shape.
Journey merge reads the current local forest again; streak merge unions current,
captured and remote reads within existing bounds. Local current-location priority,
additive merge, IDs/keys, retry marker, private server authorization and per-phase
events are retained. A completed phase remains committed if the next phase fails.
There is no new polling, keepalive, shared public cache or account rollout flag.

This is a client request-lifetime fix, not an account-storage redesign. Existing
already-persisted records still follow the legacy shared-device/guest merge policy.
It does not prove cross-account separation of previously stored browser data or
bind an unobserved server cookie change to a client owner string. Server ownership
continues to come from its authenticated session, never a submitted user ID.
Aborting a request cannot roll back an already committed server write. Broader
account partitioning, storage-write failure acknowledgment and real Google OAuth
remain separate verification work; library account rollout stays OFF.

Validation uses synthetic delayed fetch/JSON decoding and React lifecycle tests,
including transport that ignores abort, strict effect replay, stale disposer/
finally, owner changes, marker behavior, failure/retry and late local edits. These
are not real OAuth/PostgreSQL concurrency or Vercel/Neon CPU/CU/billing measurements.
No performance improvement is claimed from this correctness/refactor bundle.
