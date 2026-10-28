# PMP content snapshot

This package contains the reviewed PMP learning resource v2.18 (2026-10-27): 14 chapters, 74 lessons, 83 original multiple-choice questions, 321 glossary entries, plus 13 optional deep cases, worked examples and ungraded reflections. The content is independent study material, not an official PMI course or an exam dump.

The application entry is `/learn`; PMP opens the native Next.js catalogue at `/learn/pmp`. Offline HTML/ZIP editions are retained here as source archives and are no longer published or linked by the site. Legacy `/pmp/` URLs redirect to the native catalogue. The native lessons, existing PMP lesson IDs, browser storage format and record backup import/export remain available. PMP records are not synchronized with CS accounts.

## Rebuild

From `code/`, run `npm run build:pmp` with Python 3 to rebuild and validate the retained archive under `dist/` and `downloads/`. This command does not copy anything to `public/` or republish offline editions. `data/pmp-release.json` is historical archive metadata. The normal Next build needs no Python, network fetch, AI key, or database changes for PMP content. The generator compares the standalone HTML/readme with the reviewed release hashes and verifies every ZIP member. A content revision requires a new review manifest; do not silently accept hash mismatches.

`source/` contains the content generators and course data. `template/` contains the static UI and bundled fonts. The uncertainty plot is a checked source asset; its data signature is validated. To change that plot, install `source/plot-requirements.txt` into `source/plot-env` and regenerate it with `python uncertainty.py --plot` in that environment before rebuilding.

## Records and licenses

PMP uses its existing browser-local storage key and backup import/export. Account sync and shared CS/PM mastery records are future integration work. Downloaded files do not update automatically.

The original case narratives, diagrams and code are authored explanations with links to primary sources. SUIT, SUITE and Gowun Batang retain their separate font licenses in `template/assets/`, `dist/assets/`, and the retained offline ZIP. Source-linked publications retain their own copyrights; they are not relicensed by this repository's MIT license.

The saved QA reports describe the source release's numerical checks, desktop layout, keyboard controls, offline/no-script reading and backup compatibility. Historical mobile reports concern older releases; separate mobile generation and testing are retired. Repository-level integration tests are additional checks, not a claim of complete professional knowledge or passing an exam.
