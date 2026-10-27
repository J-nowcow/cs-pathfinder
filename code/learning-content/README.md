# Cross-track learning library

The app exposes Jira practice at `/learn/jira`, information-management engineering study at `/learn/engineer`, and a browser-local progress view at `/learn/progress`.

## Rebuild and review

Run `npm run build:library` from `code/`. This reads only checked-in sources and generates `data/engineer-{guides,index}.json`, the small record-adapter metadata, and `public/jira/`. No production DB writes, AI calls, account changes or network fetches are used. The separate reviewed PMP package remains v2.18 and is rebuilt with `npm run build:pmp`.

`engineer/guides.json` contains 24 authored concept guides: definitions, semantic flow diagrams, comparisons, original practice prompts, independent reference answers, pitfalls, related topics and scoped primary sources checked on 2026-10-27. These are not official exam answers or scoring criteria. Numeric examples were independently checked with rational arithmetic.

`engineer/source-index.json` retains 1,860 real question positions from 60 Q-Net articles, covering the collected rounds between 63 and 140. Missing earlier rounds remain explicitly unverified. Only the 31 questions of round140 include question prose, under the Q-Net notice applying KOGL type1 and AI terms from round140. Every position links to its official article; attribution and the permission notice are shown in the app. Original question text remains attributed to 한국산업인력공단 Q-Net and is not relicensed under the repository MIT license. No full earlier exam stems, mirrored PDFs, official answer claims or generated fake past questions are included.

Automatic topic candidates use exact matching over normalized technical-name aliases; automatic demand labels use verb heuristics. `classification-reviews.json` separately interprets the supplied licensed round140 text for all31 questions, preserving a SHA-256 of each source stem. Its core subject, background/context, demand labels, implicit interpretation flag, rationale and core/background guide links are editorial study metadata, not official classifications, marking criteria or expert approval. Build fails on stale text, unknown topic IDs, duplicate reviews or overlapping core/background links. Original auto candidates remain available in generated metadata for audit. Earlier1,829 slots remain unreviewed candidates; no older stems have been added. Seven reviewed questions have core guide links; nine have supplemental links (one overlaps core), and519 unreviewed records have candidate links. Thus526 have core/candidate links, eight have supplemental links only and1,326 await a guide link. All31 have reviewed subject labels even when the selected24 lessons do not cover them. The UI filters review state, guide-link role and demand; guide counts separate core, candidate and supplemental roles. Connection counts are neither identical-question recurrence counts nor future exam probabilities. OCR/legacy-conversion warnings remain. A guide connection does not promise a complete answer to that past question.

`jira/template/` preserves the prior authored 10 lessons,20 JQL answer-set exercises,16 fictional work items,60 glossary terms and33 official references. Five new missions in `jira/missions.json` connect requirements, workflow evidence, JQL, changes and reporting to PMP and engineering concepts. The public copy adds navigation and activity metadata, preserving the original `jira-garden-v1` fields. The six bundled fonts have their own OFL notices. The locally installed proprietary KT font is not bundled. The interactive offline HTML is generated from the same template and requires a JavaScript-capable browser.

## Records

Existing CS, PMP and Jira record keys are read through adapters, never rewritten by the progress view. Read counts, completed lessons and correct answer sets use different units and are not combined into a mastery percentage. Original CS visits without timestamps remain explicitly untimed. Existing CS/PMP review dates are respected; no Jira review date is inferred from a completed lesson.

New engineering and mission records use `pathfinder.library.v1`: stable IDs, drafts up to6,000 characters, checklist self-assessments, and optional1/3day KST review dates. Saves fail visibly and preserve current text. The200record limit refuses new entries rather than silently deleting older drafts. A separate backup/import round-trip covers these new records and merges the newer timestamp per item. Original CS/PMP/Jira backup formats remain available in their original screens. The library adds no cloud/account sync or draft upload.

## Validation

Meaningful tests cover source/licensing boundaries, exact alias matching and pending records, numeric examples, hostile/malformed storage, KST review dates, lossless newer-wins import, original record preservation and source dataset identity. Browser checks cover all24 topic routes, actual Jira grading and notes, mission/topic/exam drafts across reload, exact-question resume, filters/pagination, reference-answer no-JS reading, combined review/resume, backup restoration, storage denial and desktop layout. Mobile-specific work remains excluded per the user's request.

## App typography

The app now self-hosts Wanted Sans Variable for body text and SUITE Variable for headings through `next/font/local`, including the original OFL notices in `src/app/fonts/`. This replaces a Pretendard-only CSS name without a font source, which could resolve to device defaults. Font display uses swap and next/font-generated preload/hashed assets; no font CDN request or device-installed font is needed. Monospace code remains unchanged. Existing standalone PMP/Jira font pickers remain intact.
