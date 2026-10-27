# Native EVM assumption comparison

Lesson n35 now embeds an ephemeral educational calculator in StudyDesk. It
preserves the standalone default BAC100/PV50/EV40/AC50 and adds a separately
supplied ETC70 so three different assumptions yield EAC125,110,120. It does not
select a forecast automatically or claim these values form a confidence range.

The calculator compares CPI/SPI and CV/SV, plus current-CPI EAC/ETC/VAC,
remaining-plan-efficiency EAC, bottom-up EAC and BAC-target TCPI. AC may exceed
BAC; PV/EV cannot in this bounded exercise. UI amounts use0..100million budget
units with at most two decimal places; BAC must be positive. Zero denominators
are null rather than zero/Infinity. An EV0/CPI0 has no current-efficiency EAC.
Completed earned value is explicitly distinguished from remaining-work TCPI
requirements. Optional ETC may be blank; invalid supplied fields hide stale
results. Display uses6significant digits; calculations retain unrounded values.

SSR provides the complete worked default and assumptions with disabled controls
and a no-JS explanation. Presets reset all fields. No calculator localStorage,
account requests, backup changes, or original course/HTML/ZIP/generator edits.
Other schedule/risk experiments remain in the original HTML. Native float and
lesson practice, notes and navigation remain in the shared reading structure.

Primary sources checked2026-10-28 Asia/Seoul:
- PMI, EVM guide, published2026-08-31: https://www.pmi.org/blog/earned-value-management
- Lukas, PMI Congress paper, published2012-10-23: https://www.pmi.org/learning/library/make-earned-value-work-project-6001
- NSF EVM Gold Card, page undated: https://www.nsf.gov/od/ori/evm-gold-card

These support basic calculation principles and assumption limits, not exam
policy or a prediction guarantee. Examples, controls and charts are authored
independently. No source images or prose excerpts are copied.

Tests compare480 cases with the original pure helper and the independent
actual-plus-remaining-cost equation, plus boundary/precision/undefined ratios,
forecast differences, no-JS output and UI recovery. Actual Postgres/OAuth are
outside this change; account rollout remains disabled and0022 approval pending.
