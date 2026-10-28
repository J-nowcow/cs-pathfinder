# Motion Menu pilot in the native reading desk

The upstream `motion-menu` skill was installed unchanged from
[hanmariyang/giting-skills](https://github.com/hanmariyang/giting-skills/tree/2cb21ceb7bb530ef3756ca6192df7cfbfc92de2d/plugins/motion-menu),
commit `2cb21ceb7bb530ef3756ca6192df7cfbfc92de2d`. The complete plugin layout,
`menu.json`, demos and repository MIT license are retained outside this app.
The user explicitly chose the upstream skill rather than a new custom skill.
No upstream executable/build script ran, and no animation package was added to
the application. These interactions use new application code informed by the
catalog; the gallery's looping canvas runtime was not copied into the site.

Selected vocabulary: `row-box` (Row Box), `arrow-chain` (Arrow Chain),
`check-draw` (Check Draw), plus role-based ease-out/ease-in-out timing. Distances,
colors and durations are adapted to this existing reading desk, not represented
as upstream or industry defaults.

- Native PMP chapters use `<details>` with all chapters initially open. Summary
  toggles keep every existing lesson link and work without application JS.
- Authored explanation steps remain present and readable. Optional playback moves
  emphasis once through the list every 1.4 seconds, with pause, direct selection,
  next and reset controls. Nothing auto-starts, loops, scrolls or moves focus.
  Unmount, hidden document and reduced-motion preference stop the timer. Reduced
  motion keeps manual selection and removes automatic playback.
- PMP local save success draws a small check in 320ms. Failure removes the success
  check and preserves the existing failure message/current input. It never implies
  server synchronization. An answer explanation uses a 180ms, 3px reveal only when
  newly submitted; restored answers do not animate. Reduced motion removes these
  effects. Chapter arrow rotation uses 180ms ease-in-out.

No storage key, course content/ID, backup shape, session/auth behavior, DB call,
rollout flag or design system was changed. Browser QA checks keyboard disclosure,
static/no-JS text, reduced-motion behavior, finite animations, local save/restore,
quota failure and no interaction-triggered API calls. Focused tests use synthetic
browser storage; they do not establish OAuth or account restoration.

References:
[Motion Menu source](https://github.com/hanmariyang/giting-skills/blob/2cb21ceb7bb530ef3756ca6192df7cfbfc92de2d/plugins/motion-menu/skills/motion-menu/SKILL.md),
[MDN details](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/details),
[MDN reduced motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion).
