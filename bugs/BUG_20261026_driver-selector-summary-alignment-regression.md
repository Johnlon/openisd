# Driver information differs between wizard and Driver selector routes

**Status:** FIXED IN T607 PREVIEW — verified locally; not deployed to live test.

John reports that “Select driver for project” lost its number-column and unit-column
alignment fixes, and that the same driver information on the wizard route and the
corresponding Driver-area route no longer looks the same. Compare the same bundled
Tang Band W5-1138SMF on both routes at matching phone/desktop viewports; also compare
each against production and live test before attributing the regression.

The existing `mobile-driver-summary-parity.browser.spec.ts` measures parity and column
positions at 412×915 only. It measures numeric element box edges, not the painted glyphs,
and its missing/no-match drifts can collapse to zero. The new field-content detector
recognises UIField/editor fields, while the driver summary uses independent `.spec-row`,
`.spec-val b` and `.spec-unit` readouts; this inventory gap must be addressed with a
general rendered-summary contract once the actual failure is measured.

No new source fix or claim of reproduction is made yet. Evidence capture and the existing
parity test are running. Keep the earlier closed-box/Driver border evidence intact.

## Reproduced cause and failing tests

The existing 412px parity test passes (`20261026-213527-2606982.log`). Actual 374px
captures show the wizard has an extra 14px wrapper inset; its spec rows are 13px narrower
than the manager's, shifting corresponding columns. On desktop, the auto-fill grid squeezes
five columns into the summary, allowing numeric glyphs to overflow their grid cells by 7px
and overlap units (negative gaps down to -4.875px). Both live test v20261026T2106Z and
local v2119 reproduce it. Production v20261025T2233Z also has unaligned readouts; it is a
comparison, not a valid correctness oracle for this specific invariant.

The new generic `measureSummaryContent` measures real label/value/unit glyphs and per-column
alignment, including unitless numeric rows. Four route/viewport cases fail before source
changes; the unchanged detector also runs on 57 other screens, which pass for their fixtures.
Red log: `20261026-214750-2617666.log` (4 failed, 57 passed). The key missing fixture is the
populated Tang Band summary rather than an arbitrary first driver.

The fix removes the wizard's duplicate inset, gives both hosts the same summary surface,
retains two equal phone columns and uses stable 160px desktop columns rather than squeezing
in five. It preserves fonts, precision and units. Verification and new screenshots are pending.

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
