# BUG_20261115_mobile-wizard-box-type-select-width-varies

**Status:** OPEN (logged; cause not yet found; assigned to the poop session with the visual-dialog task)

## Symptom
Visual screen `mobile-wizard-vented-step3` (New project wizard, step 3, phone, Dayton Audio CX120-8, Vented) is drawn two ways on an
unchanged tree: the "Box type" dropdown either starts just after its label (committed baseline) or is narrower and starts about
60 px further right. `bash scripts/test.sh packages/ui/test/visual/visual.browser.spec.ts -g "visual mobile wizard-vented-step3$"`
passed 2 of 3 runs on 15 Nov 2026 (T794 worktree, main add89977); a full `scripts/visual/update.sh` run produced the narrow form.

## Cause
Not yet found. Likely a width taken before the label's font or text settles (field-layout measures the widest label in a group).

## Fix
In the app, test-first: the field group's width must not depend on timing. Never re-take the baseline or mask the region.

## Verification
The screen passes on 20 consecutive runs; the field-layout gate (`packages/ui/test/ui/field-layout-rules.browser.spec.ts`) passes.
