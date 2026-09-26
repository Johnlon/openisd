# BUG_20260924_inconsistent-inputs-claims-charts-blank

**Status:** RESOLVED

## Symptom

Opening driver W5-1138SMF in the driver editor shows the red strip:

> ⚠ Saves fine, but the charts stay blank because: Qts = Qes·Qms/(Qes+Qms): Qts is 0.49, the
> others imply 0.4913317191283293 · Fs = 1/(2π·√(Mms·Cms)): Fs_hz is 45, the others imply
> 48.83151010262127 · …

The charts are not blank. Every chart plots normally. The strip's claim is false.

## Evidence

- `packages/ui/src/hooks/DriverEditorModal-hooks.ts:39-46` — `chartBlockingReasonsFor` maps
  EVERY `DriverIssue` into the reasons list, including `kind === 'inconsistent-inputs'`.
- `packages/ui/src/ui/components/DriverEditorModal.vue:941-944` — that same list is rendered
  under the heading "⚠ Saves fine, but the charts stay blank because:".
- `packages/design/engine/consistency.ts:17-31` — `inconsistent-inputs` carries `target`,
  `expected`, `actual`: every value involved is PRESENT, it just disagrees with what the
  others predict. Nothing is absent, so nothing blocks a plot.
- Every reason in John's report is an `inconsistent-inputs` line ("the others imply …"); no
  "is not set" and no "cannot be calculated yet" line is present, so the four mandatory
  fields (`Fs_hz`, `Vas_m3`, `Re_ohm`, `Sd_m2`) are all set.

## Cause

`chartBlockingReasonsFor` treats the two `CalculationIssue` variants as one kind of problem.
Only `missing-dependencies` (and the mandatory-field-null check) can blank a chart. An
`inconsistent-inputs` issue is a data-quality conflict among values that all exist.

## Fix

Done 2026-09-24. The strip is split in two, and the component's rationale comment now says
three strips, not two.

`packages/ui/src/hooks/DriverEditorModal-hooks.ts`

- `chartBlockingReasonsFor` renders only `missing-dependencies` issues, plus the mandatory
  fields (`Fs_hz`, `Vas_m3`, `Re_ohm`, `Sd_m2`) that are `null`.
- New sibling `inconsistentInputReasonsFor(issues)` renders the `inconsistent-inputs` issues.
- Each is driven by a private per-issue renderer (`chartBlockingReason`,
  `inconsistentInputReason`) that switches on `issue.kind` with NO default arm, so a new
  `CalculationIssue` variant fails to compile (TS2366, "function lacks ending return
  statement") — the same idiom as `packages/design/engine/filters.ts#defaultFilter`.

`packages/ui/src/ui/components/DriverEditorModal.vue`

- New `inconsistentInputReasons` computed and a third `.de-incomplete .de-inconsistent` strip
  headed "⚠ Saves fine and the charts plot from the values as stated, but those values
  disagree because:".
- The stale FIXME saying every inconsistency reads as chart-blocking is gone; the two
  rationale comments (script and template) now state the three-way split.

## Verification

`packages/ui/test/hooks/DriverEditorModal-hooks.test.ts` (written first, watched fail: 5
failing, `inconsistentInputReasonsFor is not a function` and
`expected [Array(1)] to deeply equal []`)

- `chartBlockingReasonsFor > ignores inconsistent-inputs issues — every value they name exists,
  so no chart is blank`
- `chartBlockingReasonsFor > keeps the missing-dependencies reason when both kinds are present`
- `inconsistentInputReasonsFor > is empty when there are no issues`
- `inconsistentInputReasonsFor > describes an inconsistent-inputs issue with its formula and
  disagreement` (moved off `chartBlockingReasonsFor`, not deleted)
- `inconsistentInputReasonsFor > ignores missing-dependencies issues — an absent value is the
  chart list's business`

`packages/ui/test/logic/driver-editor-mandatory.browser.spec.ts`

- New: `stated values that disagree raise the CONSISTENCY strip, and no chart strip` — opens the
  W5-1138SMF sample project, asserts the disagreement strip is visible and contains "the others
  imply", asserts no `.de-incomplete` containing "charts stay blank", asserts OK still saves.
- The two-strips doc comment and the file-header note about W5's strip are updated to the split.
  No existing assertion was deleted or skipped.

Gate results, 2026-09-24:

| Gate                                                            | Result                         |
| --------------------------------------------------------------- | ------------------------------ |
| `npm run typecheck`                                             | design, persistence, ui all ok |
| `npx vitest run packages/design packages/persistence`           | 84 files, 1887 passed          |
| `npx vitest run packages/ui`                                    | 69 files, 514 passed           |
| `npx playwright test …/driver-editor-mandatory.browser.spec.ts` | 11 passed, 1 failed            |

The one browser failure is pre-existing and unrelated: `brand and model fields are mandatory…`
expects the Model input to take `de-input-empty` when cleared, but `editorModelValue` prefers
the derived `sku`, so a driver with a sku re-fills the cell — the "sku-derived Model cell that
cannot be emptied" the spec's own header comment already describes.
