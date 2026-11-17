# BUG_20261115_mobile-wizard-bandpass4-box-type-drawn-twice

**Status:** FIXED by T795 (same cause as BUG_20261115_mobile-wizard-box-type-select-width-varies); no second cause found.

## Symptom
Visual screen `mobile-wizard-bandpass4-step3` passed on some runs and failed on others on an unchanged tree (main a5a731de), reported as
"4th Order Bandpass" drawn twice in the Box type select.

## Cause
Not a second drawing. The picture of a bad run (read from the failed run's actual/expected pair) has the Box type select starting at
x = 139 px instead of 79 px, so its text sits 60 px further right and the comparison shows the text twice, once at each place. The select
starts at 139 = 16 + 123 when the design's default label column (`--mob-col-label` 123 px) has been put back over the measured one: Vue
rewrites the `:style` default on every render and `createPhoneLabelColumn` did not measure again (T795).

## Evidence
On main + T794 (4a920cd9), without T795: `-g "visual mobile wizard-bandpass4-step3$" --repeat-each 30` failed 11 of 30 on the first
run; a second run on the same tree passed only 17 of 30. With T795 merged: 30 of 30 passed. The T795 spec
`packages/ui/test/ui/phone-wizard-label-column.browser.spec.ts` (20 of 20 failing before, passing after) covers this screen's path.

## Fix
T795: `phoneLabelColumn.ts` measures again when its root's style attribute is rewritten.

## Verification
30 of 30 on this screen after T795; every wizard visual screen (38 screens, mobile and desktop) with `--repeat-each 10`: 380 of 380 passed.
