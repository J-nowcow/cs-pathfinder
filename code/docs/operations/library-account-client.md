# Library account client (rollout remains disabled)

The native `/learn` layout uses `LIBRARY_ACCOUNT_SYNC_ENABLED=1` to expose the
account panel. The same server flag gates the API. Next.js prerenders the layout,
so changing the flag requires a fresh deployment as well as the runtime setting.
Do not enable production until the reviewed migration, real-environment checks
and explicit execution approval in `library-account-storage.md` are complete.

## Guest and account scopes

The legacy `pathfinder.library.v1` key is always the guest source. Signing in does
not upload it, move it or replace it with account data. Opening an account is an
explicit GET and reads/writes a separate key:
`pathfinder.library.account.v1:<encoded session owner>`. Different owners have
different envelopes. The current editor/progress/backup adapter resolves only
the active scope; other CS/PMP/Jira/certificate keys keep their existing behavior.

The envelope contains the last agreed base snapshot, working copy, optional
frozen pending write, and any competing remote snapshot/comparison ancestor.
All local reads validate the complete format. Unknown/malformed/inconsistent
records are preserved and fail closed; no permissive empty-state reset occurs.
The active backup exports the existing schema1 format, not private account IDs,
request receipts or other owners' records. Import changes only the active copy.

Users may explicitly copy the guest record set into the active account's working
copy. Different entries with no overlap can combine; incompatible overlapping
entries refuse the import. The guest source remains unchanged. This copy is not
sent until the user clicks the account-save button.

## Save, retry and conflicts

Editor changes first save to the account's browser working copy. Network writes
are manual in this first version; there is no background/offline auto-upload.
A pending request UUID, expected revision and exact state are stored **before**
sending. Retries reuse all three, including across reconnect/reopen. Requests
are capped at3MB before freezing; a request timeout aborts after15seconds.

While the request is in flight, later edits remain in working. A valid reply for
the same owner/request uses a three-way merge, with the sent state as ancestor
after acknowledgement. A replay may include a newer current server snapshot;
the acknowledged revision and current revision are checked separately. Newer
local edits are retained, not replaced by a stale acknowledgement.

Different fields can merge when one side is unchanged from the ancestor.
Timestamps use the later instant. Different changes to the same answer/check/
review field, and deletion versus edit, require an explicit whole-entry choice.
The panel displays local, remote and comparison-base answers plus check/review
metadata. No further write is allowed while conflicts remain. Choosing remote
can replace a local entry; the UI asks users to copy any needed content first.
The server's next revision check still detects edits made after that choice.

Owner headers are preconditions, not authority. The server still derives the
owner from its session. The client checks the current owner before requests,
after the response/body, and before local commits. On session change it hides
the previous owner's editor and returns to guest scope. Pending requests stay
under their original owner. In-flight fetches abort when their client disposes.
An already-accepted server write cannot be undone by aborting a browser request;
its frozen receipt permits safe retry when that owner returns.

## Limits and privacy

Account keys are separate browser copies, not encrypted or protected from other
scripts/users of the same browser profile. Logout does not erase them. Server
account deletion cascades through snapshots and request receipts; browser copies
and downloaded backups remain until the user removes them. The panel and
privacy notice describe this distinction and the exact included/excluded tracks.
No answer is sent to an AI service by this client/API.

Observed local writes are rechecked immediately before setItem. This is not an
atomic cross-process transaction. The server revision protocol prevents silent
server overwrites, but exact browser storage races/crashes remain a limitation.
Failed visible input is retained in a scope-specific in-memory map while the
learn provider is mounted, including account switches. It is not durable after
every navigation, process crash or full/quota-denied storage failure. Users must
copy that input when the warning appears. Browser space holds base/working/
pending snapshots, so quota can be reached before the server's record maximum.

## Validation boundary

Tests exercise separate clients through the real API and isolated PGlite, and
the UI uses a mocked authentication session/transport. Headless desktop QA uses
synthetic users and intercepted auth/account requests only. Neither proves real
Google OAuth, actual Postgres concurrent locking or production writes. Production
keeps the flag off and migration unapplied until separately approved.

Official references checked2026-10-28: [Better Auth useSession](https://better-auth.com/docs/basic-usage#session)
and [WHATWG Web Storage](https://html.spec.whatwg.org/multipage/webstorage.html#introduction-16).
