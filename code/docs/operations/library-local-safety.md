# Local library edit protection

`local-edit.ts` validates the complete existing schema1 record before any write.
Malformed, unknown-version or partially invalid data is preserved as raw browser
storage, rather than converted to an empty state and overwritten. The legacy
`parseLibrary` reader remains available for compatibility; write paths and backup
operations now use the strict adapter.

Draft writes compare the stored draft with the editor's expected text. Checklist
and review actions read the latest state and do not copy a cached entry over it.
The editor keeps its visible draft separately from the saved entry, preserving
input on storage failure or conflict. It can display the stored draft alongside
that input. Unsent drafts are held across question changes in the same mounted
editor, with a native beforeunload warning while any remain. They are not durable
across every navigation, reload or crash: copy them before leaving after failure.

Visiting updates `visitedAt` without changing the content's `updatedAt` or review
date. Common resume order uses the newer of those timestamps.

Backup shape remains `pathfinder.library.backup`/version1. Different nonempty
drafts refuse the whole import. A blank draft cannot erase a nonempty one. For
compatible drafts, newer checklist/review metadata is retained. Invalid existing
records cannot produce a misleading empty backup or be replaced by an import.

The adapter rechecks the raw storage value immediately before writing. This is
**best-effort detection**, not an atomic cross-process localStorage CAS. Exact
simultaneous writes, platform crashes and unavailable/quota-full storage cannot
be guaranteed lossless. The disabled account server's revision/transaction path
is separate and must be integrated before claiming account synchronization.

The active browser key and existing CS/PMP/Jira/certificate keys and backup
formats are unchanged. No network upload or production migration is introduced.
The canonical JSON helper now omits undefined object fields and represents
undefined array items as null, matching JSON behavior for client adapters.

Primary reference checked2026-10-28: [WHATWG Web Storage introduction](https://html.spec.whatwg.org/multipage/webstorage.html#introduction-16).
It explicitly advises assuming no cross-agent locking mechanism; the local
pre-write comparison must not be presented as a transactional guarantee.
