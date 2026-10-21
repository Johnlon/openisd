# BUG_20261021_phone-whatif-close-chart-not-restored-sometimes

**Status:** OPEN. For maryu (phone What-if, T545), via fable.

Recorded 21 Oct 2026 by opi, from the T547 candidate run.

## Symptom
`packages/ui/test/ui/mobile-sheet.browser.spec.ts:116` ("What-if: stepping a field changes charts but not the
project; Close puts curve back") failed once: after Close on the What-if sheet, the chart picture never came back
to the one taken before the sheet opened (line 137, 20 s poll). The same code (main d66441886f) passed the spec
on T537's candidate run an hour earlier, so it fails only some of the time.

## Evidence
- Red run: https://github.com/Johnlon/openisd/actions/runs/39670707908 (land/T547, a docs-only change on
  d66441886f). Expected picture hash 20944220…, received 69d2a0d1….
- Green run on the same code: https://github.com/Johnlon/openisd/actions/runs/39667878499 (land/T537).

## Cause
Not known. Two candidates: the "before" picture is taken (line 120) before the charts have finished drawing, so it
is not the settled picture; or Close does not always put the chart back (T545 moved Auto Y into this sheet's
footer just before).

## Fix
Find which: take the "before" picture only once the charts have settled; if Close still leaves a different picture,
it is an app bug in the What-if revert.
