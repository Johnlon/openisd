# Compact field catalogue and renewed preview defects

Status: OPEN — reported by John after reviewing lap:4607.

Reports: Fpr with mass is wider than peer fields; PR still appears as ReplaceMe with missing
Qms and diagnostics; dummy PR must cover at least the active driver's displacement; locate
the thicker speaker silhouette; counts in Tune/What-if must match dropdowns elsewhere;
AllPass Order has a floating model cue.

Ruling: stacked layouts rejected. Produce compact narrower gallery versions of every page,
with DQ outside left and model cue outside right hugging the spinner/dropdown. Avoid label
newlines where possible. The accepted field catalogue is the only valid appearance reference.
No previous green sweep closes these new reports.

Reproduced 27 October: the old source-grep test required readouts to expand into the absent
90px stepper track. It protected the visible Fpr widening. A native geometry test now rejects
that difference. Existing seed tests exercised only a new placeholder after a PR type switch;
they missed dormant seeding, saved ReplaceMe records and driver-array size. Three new failing
domain cases and a failing wizard case exposed those gaps before the fixes.

Approval boundary: John requires approval of the use cases, on one HTML page containing the
controls. The proposal lives in `docs/design/field-use-cases.html`, published under
`build/ui-contract/use-cases/`. It is not an approved standard. Page-audit work is retained.
The same compact DOM checker exposed unresolved Tune/What-if inputs still 160px wide with
units inside; these are tracked red tests, not silently accepted exceptions.
