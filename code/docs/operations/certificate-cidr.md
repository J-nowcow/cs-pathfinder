# Independent IPv4 address lesson

The native certificate shelf previously had no network-address reading lesson.
This release adds one authored IPv4 CIDR lesson from the original th-cidr topic
and preserves its provenance/reference. The source concepts-theory.json is
read-only, with its previous SHA256 checked. No exam/recalled code, questions,
solutions, original images or source prose are imported.

The source of truth is learning-content/certificate/course.json. A fixed
cidrExample drives the address-bit figure; the displayed calculation table is
independently checked against that model. The previous15 lesson objects,
checklists, IDs, SQL example data and version1 record/backup format are unchanged.
The new network domain adds one route and shared resume/review support.

Primary documents checked2026-10-28:
- RFC4632, BCP122, August2006: prefix notation, block sizes and host routes.
  https://www.rfc-editor.org/rfc/rfc4632.html
- RFC3021, Standards Track document, December2000: both /31 addresses are host
  addresses in the stated IPv4 point-to-point context.
  https://www.rfc-editor.org/rfc/rfc3021.html
- RFC5737, Informational, January2010: documentation address blocks.
  https://www.rfc-editor.org/rfc/rfc5737.html
Ownership/edition notices remain in the lesson sources. No RFC prose, numerical
worked case, figure or code component is copied. This is an independent teaching
example and does not claim current exam policy, accredited training or full scope.

The fictional reading-room example uses192.0.2.40/26. The last byte is00101000,
mask11000000, network result00000000; the complete mask is255.255.255.192.
The block is192.0.2.0..63 inclusive:64 addresses. Under ordinary broadcast-LAN
reservation, host slots are.1..62 (62), before gateway/platform reservations.
The /24 divides into four non-overlapping /26s at.0/.64/.128/.192:256 total
addresses and248 ordinary-LAN host slots, versus254 for one /24. A /31 example
is explicitly point-to-point under RFC3021; /32 denotes one address/host route.
The lesson never applies minus2 universally or proves actual connectivity.

Independent verification uses Node BigInt32-bit arithmetic, all256 last-byte
membership checks, and Python ipaddress for the displayed mask/ranges, four
subnets, all33 prefix lengths and /31-/32 context examples. Storage tests retain
a complete previous15-record fixture while adding the new note and check mixed
backup merge and same-note conflict preservation. No network settings change,
real address allocation, device access or production DB writes are included.
Desktop QA must verify the figure/table at22px, catalogue/resume/navigation,
legacy/new notes and backup, no-JS reading and no API writes before publication.
