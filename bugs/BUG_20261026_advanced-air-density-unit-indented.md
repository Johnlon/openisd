# Advanced environment air-density unit is indented left

**Status:** FIXED IN T607 PREVIEW — verified locally; not deployed to live test.

John reports that the air-density unit on Advanced environment is indented to the left instead of aligning with the other units. Capture the matching production/test/local state, measure unit-column edges, add a general failing alignment assertion before changing layout, and run it across related rows.

## Reproduced cause and red test

The fixed kg/m³ label is classified as a wide boxed chip because its text exceeds three
characters, although it has no clickable-chip padding and its glyphs fit the normal 40px
rail. Its box starts at x203 while the other environment units start at x227. The right
edges remain x267; the extra 24px width indents the label left.

A new general assertion rejects fixed labels whose glyphs fit the normal rail but reserve
a wider one. The existing Advanced content case fails for Air density before the source
change (`20261026-215513-2628379.log`). Wide-chip padding is now reserved for clickable
chips only; actual long fixed labels retain intrinsic sizing and collision checks.

The earlier recorder initially measured the covered Box page beneath the Advanced dialog;
those perimeter failures are recorder scope errors, not claimed Advanced border defects.
The screenshot and full-document unit measurements establish the actual indentation above.

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
