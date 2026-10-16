# BUG_20261016_mobile-row-labels-touch-the-row-border

**Status:** RESOLVED

## Symptom
On the phone Box, Signal, Enclosure (and Advanced) rows, the field label ("System input power", "Volume")
touches the row's top border and sits tight on the input. Found in the `/test/` against live comparison
(shots-regress-20261016, row D2).

## Cause
T197 set the shared row metrics to `--mob-row-pad-y: 2px` and `--mob-label-lh: 12px`. The label text is
13px, so its line box (12px) is shorter than its own text and the text spills onto the border.

## Fix
T240: `--mob-label-lh: 16px`, `--mob-row-pad-y: 4px`. The Tune/Learn sheet keeps its old values (set on
`.mob-sheet`) so its height is unchanged. Rows stay denser than before T197.

## Verification
`packages/ui/test/ui/mobile-row-labels.browser.spec.ts`: for every row on the Box, Signal and Vented
tabs, the label line is at least as tall as its text, sits below the top border and ends above the
input. It failed before the change ("label line 12px is shorter than its 13px text") and passes after.
