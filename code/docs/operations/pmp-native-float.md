# Native PMP float experiment

Lesson n44 renders the existing authored `course.json.floatLab` in StudyDesk.
The server passes only that configuration and the CPM source to the client;
the original course, standalone HTML, ZIP and generators are unchanged.
The home links directly to the native experiment. Other EVM, schedule and
risk calculators remain in the original HTML and are described as such.

Scope: five fixed activities, FS relationships, start at zero, integer durations
1–100 days. No calendars, resources, leads, lags or imposed deadlines. Editing
changes durations and recalculates; it does not simulate delaying only a start.
Presets replace all durations from the baseline, never accumulate. Inputs are
ephemeral and do not enter existing learning/backup/account storage.

Forward/backward passes calculate ES/EF/LS/LF/TF/FF. The terminal LF and FF
reference the project early finish. All equally longest authored paths are
marked critical. Invalid fields hide the previous result. SSR includes the full
default calculation, accessible diagram, table, formulas and observations;
controls stay disabled until hydrated. No-JS readers receive a precise notice.

Primary reference: Kramer and Jenkins, PMI Global Congress 2006,
[Understanding the basics of CPM calculations](https://www.pmi.org/learning/library/2019/04/07/15/39/critical-path-method-calculations-scheduling-8040),
verified 2026-10-28 Asia/Seoul. This historical mathematical reference is not
current PMP exam policy. The five-activity example and diagram are independently
authored. No source illustrations are copied.

Validation includes explicit independently worked rows, 1,024 closed-form path
comparisons, tie/switch/shared-float presets, bounds/invalid input, no mutation,
UI reset/error recovery and server-rendered no-JS controls. Desktop browser QA
checks actual graph, keyboard operation, storage preservation, no network writes
and no-JS default reading. No production DB writes or account activation.
