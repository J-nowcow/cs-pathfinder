# Native PMP full-record backup

`/learn/pmp#pmp-backup` and `/learn/progress#pmp-backup` use the existing
`pmp-pathfinder-v1` key and version1 shape. No storage migration, server upload,
account synchronization or other-track writes are introduced. Lesson/case IDs,
original offline HTML/ZIP and source generators are unchanged.

Export saves the browser's **exact raw string**, including unknown future fields
or malformed JSON, as a rescue copy. It does not claim that such a file can be
restored. Unsaved visible input is not part of browser storage or this export.
An absent key exports `{version:1}`. Import accepts the original HTML's JSON,
including exportedAt metadata, and strictly checks all known fields/IDs/option
correctness and limits; unknown/future/malformed entries refuse the whole import
instead of silently sanitizing them away. The8,000,000-byte file/decoded UTF-8 cap
accommodates full valid legacy note maps; original files below its5MB cap still
work. Old HTML retains its own5MB import limit, so very large exports may need the
new native importer. Text remains limited to12,000 characters per lesson/field.

A preview is mandatory, even without overlap. Missing incoming fields never
delete existing fields. Disjoint maps merge; seen timestamps and matching-answer
attempts retain the newer timestamp; bookmarks and unique journey tuples merge.
Different nonempty/blank existing text, different answers, reviews, recall and
individual legacy preference fields require explicit browser/file choices.
Preferences remain legacy data and never change StudyDesk typography/appearance.
More than5,000 combined journey records requires an explicit choice of one whole
history; there is no automatic truncation. Users can export both originals first.
File export metadata is not imported as a learning record.

After reading a file, all choices are based on a captured raw browser snapshot.
Storage/focus/PMP events mark stale previews; application rechecks the exact raw
value immediately before the one-key write. Changes require a fresh comparison
and reset the old choices. This is a best-effort observation, not atomic
multi-process localStorage compare-and-set. Storage failures keep the preview and
original data; malformed current data is never reset just to permit import.
File reads use a generation counter so a late file/unmounted component cannot
replace a newer selection. No file contents are logged, sent to an API or inserted
as HTML. The comparison view renders text with React escaping.

Validation includes all74 real lessons and83 scenario answer records through the
preserved HTML sanitizer, explicit per-field decisions, newer/disjoint data,
journey overflow, malformed/unknown records, wrong answer grading, size limits,
changed-after-preview, quota failure and exact malformed rescue download. Tests
use synthetic notes only. Desktop browser checks verify cross-tab recompare,
real download bytes, old/new HTML exchange, no network upload, original other
keys, fonts/readability and no-JS reading. OAuth and production DB remain outside
this local-only feature.
