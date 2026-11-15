# Contributing an evidence-based learning case

The first module lives at `/learn/cases/github-migration-2026`. It is a bilingual, authored exercise using published retrospective evidence. It is not a replay of the incident, an approved response procedure, or a validated skill assessment.

## Find and change content

1. Edit `src/lib/cases/content.ts`. Common facts, terminology, outcome, and principles are separate from each role’s objective, initial prompt, authored example, transfer prompt, and checks. Update both `ko` and `en` entries. Each `F1`–`F3` statement must remain traceable to the linked source’s May 4 section.
2. Distinguish reported facts from educational assumptions and author interpretation. Do not invent historic logs, thresholds, losses, or decisions. Do not label a worked example as expert-reviewed unless a real review with a scope and date is recorded.
3. Keep each role aligned. Developer: observations, hypothesis, and counterevidence. Project manager: affected dependencies, consultation/approval, and pause/resume conditions. Product manager: affected user tasks and recovery evidence. These are bounded tasks, not full occupational standards. Do not assume a PM has operational approval authority.
4. Review both languages for facts, negation, uncertainty, and conditions. Three corresponding check positions refer to the same reasoning in each language. Check completion is self-assessment, not an externally scored result.
5. Bump `CONTENT_VERSION` when a changed task or check would change the meaning of an existing answer. Current v1 storage refuses incompatible records without overwriting them; a future version needs a reviewed migration or an old-content reading path. This pilot does not implement content migrations.

UI translations are in `src/components/cases/copy.ts`, the flow in `CaseLesson.tsx`, and scoped styles in `src/app/case-learning.css`. The source report’s copyright remains with its publisher; its full text is not bundled or relicensed. The authored prompts and examples follow the repository license.

## Reproduce checks

Run from `code/` in a checkout without private `.env.local` files:

```sh
npm ci --ignore-scripts --legacy-peer-deps
DATABASE_URL= USE_REAL_DB=0 LIBRARY_ACCOUNT_SYNC_ENABLED=0 npm test -- tests/cases tests/app/home-routing.test.tsx tests/library/StudyNavigation.test.tsx
npm run typecheck
DATABASE_URL= USE_REAL_DB=0 LIBRARY_ACCOUNT_SYNC_ENABLED=0 npm run build
DATABASE_URL= USE_REAL_DB=0 LIBRARY_ACCOUNT_SYNC_ENABLED=0 npm run start -- --hostname 127.0.0.1 --port 3046
```

The database URL is deliberately empty: other pages in the existing build may seed a database. The module itself has no database, AI, or network dependency beyond linking to references. Do not copy private environment files to run these checks.

In a browser, open the module and check: initial example hidden; first judgment preserved; revision; new-condition answer without the example; save and return; separate role drafts; language switch; example-open then role-switch; keyboard access and focus after transitions. On return after the new-condition submission, earlier answers and the example stay hidden until the first re-explanation is recorded. Common facts and glossary remain available, so this is not unaided, uncued recall. Assistance is self-reported and example exposure records only that a disclosure was opened, not that it was read.

## Records and limitations

`pathfinder.case.github-migration-2026.v1` stores this module separately from existing library/account records. Save is explicit. An unsaved draft survives role/language changes in the same mounted page, but leaving the page can lose it. Save before navigation. Saving checks the last-read storage value and refuses known conflicting, malformed, or incompatible records. Download exports a JSON file for safekeeping; the pilot has no import UI.

The first answer records example disclosure and external-help self-report separately. Later answers preserve self-report, submission time, optional review target, and actual elapsed time. Review dates are reminders visible on return to this module; no notifications or account-library review integration are provided. Selecting 1 or 3 days is not an assertion about the best learning interval.

Tests and screen review establish implemented behavior. They do not establish ease of learning for all adults, occupational transfer, or improved learning outcomes. Before publishing Korean changes, follow the project’s `humanize-korean` review and pre-push gate requirements.
