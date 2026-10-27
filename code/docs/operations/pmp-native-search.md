# Native PMP reading search

Observed gap: the native catalogue listed74 lessons in14 chapters but had no
body search. A reader who remembers negative float rather than lesson44's title
had to open candidate lessons or return to the standalone HTML.

The catalogue now offers a plain GET form targeting /learn/pmp/search?q=.
Only that result page reads awaited searchParams and renders at request time;
the catalogue and lesson routes retain their static behavior. No database,
external search provider, model or client search index is used. Queries appear
in browser history/URLs and may enter ordinary hosting request logs; this is
not a private memo search. The UI explains the scope and URL behavior.
Autocomplete is disabled on the form: initial desktop QA found that browser
history could restore a subsequently edited input over the previous result
page's query. Back/forward checks must compare URL, input and result together.

The in-process public index uses the same source snapshot and reading order.
Fields: lesson title, question heading, answer lead, body, steps, comparison
table rows, worked examples, trap, HTML supplement visible text and the term
aliases/definitions actually shown in that lesson. It does not traverse the
whole JSON, quiz choices/explanations, private records, separate cases or native
interactive lab copy. Source-only supplementSearch metadata is not indexed.

NFC, case and whitespace normalization precede literal AND-token matching.
All tokens must appear somewhere in a lesson. Full title-token matches rank
first, partial title-token matches second, then body-only matches. Each tier
follows reading order. One result per lesson includes the best matching public
passage (up to220 characters plus ellipses); snippets are text, never HTML.
There is no semantic synonym expansion, typo correction or relevance guarantee.

Empty input prompts rather than returning all lessons. Query text is limited
to120 UTF-16 code units, matching maxlength; overlong direct URLs show a bounded
input preview and an error without searching. Repeated q parameters are
rejected rather than silently selecting one. User text is never interpreted
as a regular expression or rendered with dangerouslySetInnerHTML. Results use
robots noindex and existing native lesson links. Search itself reads/writes
no learning records; opening a lesson retains its existing visit behavior.

Framework reference checked2026-10-28:
https://nextjs.org/docs/app/api-reference/file-conventions/page#searchparams-optional
Official page last updated2026-06-09; installed Next.js16.2.6 remains unchanged.
The reference documents promised searchParams, repeated-key arrays and dynamic
request rendering. No library or deployment policy change is inferred.

Validation: actual source title reachability for all74 lessons, non-title
concepts and rich content, term aliases, case/NFC/AND matching, stable tier order,
literal punctuation, empty/overlong/ambiguous input, text entity handling and
server-rendered accessible form. Desktop browser coverage adds actual GET,
refresh/history, native reading entry, no-JS submission,22px, empty/error/XSS
recovery and preservation of synthetic notes before opening a lesson.
