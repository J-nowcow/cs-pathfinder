# Backup selection lifetime

A delayed `File.text()` completion could previously import a file after another
file was selected or after the backup component unmounted. In the library screen,
a guest import could also finish after the visible scope changed to an account:
it still targeted the old guest store, changing records outside the current view.
A stale read failure could replace the newest successful import notice.

LibraryProgress now binds each read to a monotonically increasing selection token
and the current ready scope. New selections, scope/readiness transitions and
unmount invalidate older reads. Both successful and failed completions check the
binding before parsing, merging, writing, emitting an update or changing a notice.
CertificateBackup uses the same selection/unmount lifetime rule for its separate
browser-local key. Existing PMP backup already has a selection serial guard and
is unchanged.

This ignores stale completions; it does not cancel the underlying file I/O or add
a cross-tab atomic transaction. Existing strict parsing, size/entry limits,
different-answer refusal, merge semantics, schema1 backups and per-track keys are
unchanged. Import stays local and never triggers an automatic account upload.
No Korean UI strings, fonts, layout, original study materials or DB schema change.

## Evidence and limits

Before the fix, five library lifetime assertions and three certificate assertions
failed against the existing implementation. The successful current-account import
control passed. After the fix, the related nine files/42 tests pass, including the
nine new lifetime cases and existing conflict/retry/backup tests. Typecheck and a
production build pass. The prior full suite (226 files/1,942 tests) is retained as
historical evidence, not relabeled as a full-suite run for this change.

Synthetic component tests exercise guest-to-account, loading-to-guest, out-of-order
reads, stale failures, unmount and a valid current-account local import. Desktop
Chrome QA delays the first read, finishes a newer file, releases the older read,
and verifies that only the latest import and notice remain across reload for the
library and certificate keys. Its fresh browser context uses authored test data,
not user notes. It performs no API writes. Account scope-switch tests use a
synthetic provider; they do not prove Google OAuth or production account storage.

The production rollout flag remains off. The approved migration0022 was already
applied separately and is not rerun by this change. Actual OAuth, the enabled
Vercel target/readiness gate and authenticated save/restore remain pending.
