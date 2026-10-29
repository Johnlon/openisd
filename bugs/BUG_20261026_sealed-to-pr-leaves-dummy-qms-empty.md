# Sealed to passive radiator leaves the seeded radiator Qms empty

**Status:** FIXED IN T607 PREVIEW — verified locally; not deployed to live test.

John reports that creating a sealed project and then switching to passive radiator leaves Qms empty. The project should receive a dummy but internally consistent radiator. Rename the placeholder from ReplaceMe to Dummy PR. Reproduce through the UI, add a failing domain transition/seeding test before fixing the seeding source, and verify populated consistent fields after the transition.

## Cause and TDD

The box-type seed deliberately omitted Qms, and the old starting-values test explicitly
expected null. That leaves the dummy radiator's mechanical damping unresolved. The seed
name was also explicitly ReplaceMe. Independent name and mechanical-Q tests fail before
source changes (`20261026-215228-2626523.log`: 2 failed, 8 passed).

The new dummy defaults to Qms 5; with the existing 50g mass and 0.5mm/N compliance this
resolves Fs 31.8309886Hz and Rms 2Ns/m consistently. Its default model is Dummy PR. The
mechanical-Q default applies only to the identified dummy, not named real radiators with
unknown Qms. Existing entered names and nonblank Qms survive type switches.

## Verified outcome

Normal preview v20261026T2158Z shows this fix; the later v20261026T2221Z also includes the
compact cue-spacing repair. Matched production/test/local images and measured DOM records
are in `build/ui-contract/followup/`; current precision checks are in `build/ui-contract/precision/`.
I personally compared the images. Gemini inspected all 23 follow-up/trial images and judged
the three fixes visually beneficial without harmful visible deviations in those views.
Its original report is preserved; source-code inaccuracies in that report are corrected in
the task log, rather than accepted as facts.

Final evidence: 62 summary cases pass (`20261026-214954-2621041.log`), the expanded
six-phone summary/browser/wizard/PR/Editor checks pass 90/90 (`220114-2642100.log`),
195 field/summary cases pass (`215633-2630795.log`), and the later final field/unit suite
passes 255/255 (`221350-2659020.log`). Dummy seed/design/ownership checks pass 22 tests
(`221353-2659259.log`); the exact new-sealed-to-PR wizard path passes
(`215748-2634112.log`). Final lint (`222116-2681808.log`) and full typecheck
(`222422-2689368.log`) pass.
