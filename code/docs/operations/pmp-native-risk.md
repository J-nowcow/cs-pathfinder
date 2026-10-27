# Native expected-loss and threshold experiment

Lesson n27 embeds the original A30 / p20% / loss100 / limit50 example in
StudyDesk. Costs and losses are nonnegative. B has exactly two exclusive events:
the incident causes the supplied loss, otherwise monetary loss is0. Shared
costs, insurance and other benefits are excluded. This is an authored teaching
model, not an automatic alternative recommendation or organizational policy.

Three fixed contrast examples all have expected loss20:20%/100,10%/200,40%/50.
With an explicitly fixed threshold50 their exceedance probabilities are20%,10%
and0%. Equality is within the threshold. If A exceeds the threshold, its
exceedance probability is100%. If p0, B exceedance is0 within the model even if
the supplied conditional loss is high; this does not prove real impossibility.

All four fields reset on every preset. Amounts are0..1million and probability
0..100%, at most two decimal places. Monetary cents and probability basis points
yield integer products no larger than1e12, so exact tie comparison does not rely
on display rounding. Six significant display digits preserve tiny nonzero
expectations. Invalid inputs hide current outputs; the explicitly fixed contrast
table remains available. No persistence, account requests or backup changes.

SSR provides the full default, fixed table, formulas and limits; controls remain
disabled without hydration and a no-JS notice explains that scope. Inputs,
buttons and table follow the selected18/20/22px reading size. The original course,
question IDs, standalone HTML/ZIP and generators remain unchanged.

Primary reference checked2026-10-28 Asia/Seoul: Hulett, D. T.(2006),
[Decision tree analysis for the risk averse organization](https://www.pmi.org/learning/library/decision-tree-analysis-expected-utility-8214),
PMI Global Congress2006—EMEA. The page displays October2006; no exact event day
is inferred. This supports expectation versus risk attitude, not current exam
policy. No source examples, images or prose excerpts are copied. Threshold
exceedance is derived directly from the authored two-event model.

Validation uses1120 distributions against a BigInt enumeration oracle, exact
ties, zero/100% and equal-threshold cases, tiny expectations, bounds, no-JS,
UI reset/error recovery and desktop22px/offline-after-load/storage preservation.
No production DB migration, test writes, OAuth verification or account activation.
