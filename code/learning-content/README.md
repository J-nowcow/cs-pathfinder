# Cross-track learning library

The app exposes Jira practice at `/learn/jira`, information-management engineering study at `/learn/engineer`, and a browser-local progress view at `/learn/progress`.

## Rebuild and review

Run `npm run build:library` from `code/`. This reads only checked-in sources and generates `data/engineer-{guides,index}.json`, the small record-adapter metadata, and `public/jira/`. No production DB writes, AI calls, account changes or network fetches are used. The separate reviewed PMP package remains v2.18 and is rebuilt with `npm run build:pmp`.

`engineer/guides.json` contains 24 authored concept guides: definitions, semantic flow diagrams, comparisons, original practice prompts, independent reference answers, pitfalls, related topics and scoped primary sources checked on 2026-10-27. These are not official exam answers or scoring criteria. Numeric examples were independently checked with rational arithmetic.

`engineer/source-index.json` retains 1,860 real question positions from 60 Q-Net articles, covering the collected rounds between 63 and 140. Missing earlier rounds remain explicitly unverified. Only the 31 questions of round140 include question prose, under the Q-Net notice applying KOGL type1 and AI terms from round140. Every position links to its official article; attribution and the permission notice are shown in the app. Original question text remains attributed to 한국산업인력공단 Q-Net and is not relicensed under the repository MIT license. No full earlier exam stems, mirrored PDFs, official answer claims or generated fake past questions are included.

Topic links use exact matching over normalized factual technical-name aliases; question-demand labels use verb heuristics over the original extraction. Both are unreviewed candidates. At this release, 538 records link to the selected24 guides and1,322 remain outside those guide links. All records remain searchable by round, session and technical-name index. Connection counts are neither identical-question recurrence counts nor future exam probabilities. OCR/legacy-conversion warnings are retained.

`jira/template/` preserves the prior authored 10 lessons,20 JQL answer-set exercises,16 fictional work items,60 glossary terms and33 official references. Five new missions in `jira/missions.json` connect requirements, workflow evidence, JQL, changes and reporting to PMP and engineering concepts. The public copy adds navigation and activity metadata, preserving the original `jira-garden-v1` fields. The six bundled fonts have their own OFL notices. The locally installed proprietary KT font is not bundled. The interactive offline HTML is generated from the same template and requires a JavaScript-capable browser.

## Records

Existing CS, PMP and Jira record keys are read through adapters, never rewritten by the progress view. Read counts, completed lessons and correct answer sets use different units and are not combined into a mastery percentage. Original CS visits without timestamps remain explicitly untimed. Existing CS/PMP review dates are respected; no Jira review date is inferred from a completed lesson.

New engineering and mission records use `pathfinder.library.v1`: stable IDs, drafts up to6,000 characters, checklist self-assessments, and optional1/3day KST review dates. Saves fail visibly and preserve current text. The200record limit refuses new entries rather than silently deleting older drafts. A separate backup/import round-trip covers these new records and merges the newer timestamp per item. Original CS/PMP/Jira backup formats remain available in their original screens. The library adds no cloud/account sync or draft upload.

## Validation

Meaningful tests cover source/licensing boundaries, exact alias matching and pending records, numeric examples, hostile/malformed storage, KST review dates, lossless newer-wins import, original record preservation and source dataset identity. Browser checks cover all24 topic routes, actual Jira grading and notes, mission/topic/exam drafts across reload, exact-question resume, filters/pagination, reference-answer no-JS reading, combined review/resume, backup restoration, storage denial and desktop layout. Mobile-specific work remains excluded per the user's request.
