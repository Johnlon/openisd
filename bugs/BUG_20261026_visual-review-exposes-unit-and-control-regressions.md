# Independent visual review found further unit and control regressions

**Status:** OPEN — Gemini findings reproduced by additional general DOM checks.

## Review evidence

John explicitly requested independent visual criticism. agy, using Gemini 4 Argon High,
inspected all 18 production/test/first-candidate PNGs for closed box, Driver and Driver Editor
at phone and desktop sizes. Its report is `build/ui-contract/gemini-visual-review.txt`.
The first candidate passed 131 tests but was rejected by the visual reviewer.

## Findings and missing assertions

1. Desktop Driver AlfaVC's 1000/K glyphs overflow a fixed 34px unit box and extend onto the
   decrease button. The first checker measured the value's text, not the unit's own glyphs
   or collisions between adornments. Measure every unit's text bounds and pairwise adornments.
2. Fixed units have opaque white backgrounds, creating white patches on grey readouts and
   desktop modal surfaces. Insetting the patch restored borders without restoring the surface.
   Assert that a fixed label preserves the underlying surface rather than painting a box.
3. Phone action links dropped from production's 14px to 12px and moved outside the form's
   text margin. Field-only selectors missed the links. Check the action-link family as well.
4. Phone toggle chips lost their left divider, and thin chip borders could cover the stronger
   mandatory field border. Check divider presence and require visible border samples to belong
   to a real border strip; the previous extra 0.05px acceptance admitted covered inner pixels.
5. Desktop unit chips became shorter than the 28px controls they join. Check their height
   against the adjoining value control.
6. Desktop mandatory borders lost production contrast. Preserve production's two-pixel dark
   border and check it explicitly.
7. Desktop numeric values changed to right alignment, unlike production and the restored phone
   fields. Restore the production convention and assert it in the general content checker.
8. Fixed-width desktop inputs shrink because the value container and stepper both contribute
   spacing. Check declared pixel widths against rendered box widths using CSS Typed OM.

The first two fixes (left-aligned phone digits and restored border segments) were beneficial,
but they were insufficient evidence that all differences were beneficial. The wider phone
readouts are independently judged useful and should be retained.

## TDD

Before further UI source edits, the expanded checker fails all four representative cases:
closed box phone, Driver desktop, and phone/desktop Editor Parameters. Red evidence:
`build/test-logs/20261026-203402-2428710.log`. Apply the same expanded checks across other
screen cases before fixing source. Do not accept an updated baseline as proof of correctness.

Two old style tests explicitly expected opaque white fixed-unit backgrounds. Those expectations
encoded this defect. Replace them with strict transparent-label expectations alongside the new
border and surface assertions; retain the grey clickable-unit, underline and interaction checks.

## Second review and narrow-phone regression

Gemini's second review inspected all 18 v2103 images and again rejected the candidate.
It identified a widened AlfaVC unit pushing the adjacent desktop explanatory paragraph
through its clipping boundary, and identical mm chips stretched to different subgrid widths.
The shared checker now measures hint text against clipping ancestors, identical unit-chip
widths, and chip/value top alignment. Both representative cases fail before those source
changes: `20261026-211403-2563495.log`.

The 292-case contract/phone run passed 291 and failed Editor Advanced at 360px
(`20261026-205827-2531913.log`). The new input-content clipping check and the populated
bundled-driver fixture reproduce gamma clipping plus Rme/Mpow warning collisions
(`20261026-211117-2558188.log`). The comparison project's blank reference fields alone
were insufficient fixture coverage. Moving warnings beside labels and removing an unused
four-pixel padding allowance passes both the new regression and the existing narrow-phone
case (`20261026-211227-2561089.log`).

The desktop fixes make chips use their own intrinsic width within the shared grid tracks,
centre each field's controls vertically, and let the Driver explanation wrap within its pane.
These changes preserve the larger chip needed for 1000/K without clipping adjacent text.

One Gemini observation was incorrect: the captured mobile Fs/Vas mandatory input and chip
borders are both exactly `2px solid rgb(196, 196, 196)` in the saved DOM records, not
different colours. No speculative colour fix was applied. A general border-continuity
assertion now also compares the covering chip's border thickness and colour for mandatory
phone inputs, to make this measurable in future.

Applying the numeric clipping detector to the other pages also found desktop Box Fb
`35.90024611` needing 80.71px in a 76px content area. The shared desktop input keeps its
90px outer width, font and control size while reducing horizontal padding from 6px to 3px,
providing 82px of text area. This is an actual additional defect, not a bitmap difference.
The same sweep initially treated intentionally scrolling project-name editors as display
readouts; clipping assertions now apply to numeric controls, while value/adornment collision
checks still cover the full field inventory. Native multiline notes retain wrapping.
The interrupted sweep log is `20261026-211552-2566031.log`; no pass is claimed for it.

## Final visual review and test reconciliation

Gemini inspected all 18 final v2119 images and found no remaining blocking or harmful visible
deviations. The full report is `build/ui-contract/gemini-final-review.txt`. It independently
confirmed the mandatory-border colour evidence. Both rejected rounds remain archived.

The additional six-spec run passed 139 cases and failed two old Driver Editor expectations
(`20261026-212547-2589428.log`): another opaque-white fixed-label expectation, and a claim
that all unit labels must have the same width regardless of text. The fixed-label assertion
now strictly requires transparency. The width test's stated purpose was preventing column
movement during unit rotation; comparing unlike unit-label widths did not test that behaviour
and forced long units to overflow. The replacement retains the test and verifies the actual
number-column positions through every Dimensions unit cycle, while applying the shared glyph
fit/collision and equal-unit consistency checks at every step. No application code is changed
for this test reconciliation.

The reviewer identified five remaining broader coverage limits: labels versus warning cues and
vertical row overflow, selected-option text fit, standalone desktop chip/stepper border paint,
hints colliding where ancestor overflow is visible, and non-default unit states across the full
page matrix. These are tracked open extensions of the original F1–F12 audit, not observed new
defects in the six final images. The Dimensions cycle check adds non-default unit coverage in
that tab; it does not close the full state-inventory gap.


## 27 Oct follow-up: wide desktop inputs covered spinners

John reported Cms broken in the desktop editor image (QO305.c34), wizard list missing its left
margin (c36), and the old desktop Mms toggle affordance (c38/c40). The cases were reproduced
with DOM assertions, without new desktop images. Cms input.right=636.16 while unit.right=612.84;
both spinner buttons overlapped the complete input. Rms and six Advanced/Parameters rows had
the same defect. The parent subgrid sized the box track while a separate minimum enlarged only
the input wrapper for wide units. Removing that conflicting minimum restores a shared edge.

The old content contract checked text-to-adornment and adornment-to-adornment collisions.
It could accept a blank part of the input border behind the spinner. The shared contract now
also checks the full input rectangle against every visible spinner and requires the unit cap
right edge to equal the complete input's right edge. A controlled mutation independently
asserts an actual12px input enlargement before requiring both failures. Its first attempt was
absorbed by flex sizing; that was a bad mutation, not evidence of detector effectiveness, and
was corrected with flex:none. The corrected mutation passes181826. All other161shared cases
pass181455.61unit-style/What-if cases pass181618. No image-based or AI verdict is claimed.

The phone wizard omitted DriverLibrary's phone prop, so its driver-list inset used the desktop
presentation. The prop is now supplied; list inset and preview margins are tested alongside
existing Next/Cancel behaviour. The repeated unsaved-project banner has been removed from both
wizard templates at John's request, with tests preserving the original edited value and the
Projects list's Unsaved marker after cancellation. Desktop toggles use the explicit selected
solid blue mobile underline. Existing independent paint references were amended only for those
three requested underline properties, rather than regenerated from the implementation.


## Argon follow-up, 27 Oct18:35 — OPEN Advanced clipping

Independent review of10existing images plus commit8dd302942 returned concrete scenario gaps.
A bounded DOM audit across80unit rotations confirmed Advanced gamma248.87192 N/(A·kg)
requires64.00px but has58.89px, already on entering Advanced with the seeded test driver.
Changing air density to g/cm³ displays0.00120095, requiring73.08px but with58.88px available;
it also overlaps the unit cap. The content detector reports these failures once exercised.
Previous passing scenarios used different values; the permanent rotation test covered only
Dimensions. Add seeded Parameters/Advanced and display-precision/unit-choice scenarios and
fix the complete joined control sizing before deployment. Do not conceal the issue by dropping
precision, weakening the measurement, stamping image hashes, or treating the diagnostic probe's
completion as visual conformance. Parameters/Dimensions showed no issues for this bounded cycle.

Argon's editor underline-collision estimate assumed20pxchip height. Actual editor chips measure
28px and retain at least1.42px calculated clearance; no automatic underline change is justified
by that estimate. Its Info-button criticism also missed John's explicit request for Info.
The full report, provenance, root disposition and measured JSON are in
`docs/design/reviews/T607-argon-20261027-*`. These are pre-fix image comparisons, not a visual
sign-off for1818. No new desktop capture or application change was made during this review.


27Oct19:24repair: value/unit track sizing fixed together at150px, preserving displayed precision.
Editor grows to1100px on large desktops and uses3/2field columns on smaller desktops. Permanent
seeded full-unit-cycle coverage now covers Parameters, Advanced and Dimensions;40affected editor
checks pass191702 and complete control containment/content/borders pass on every tab at780,
1024and1280(191940). The former gamma/density findings are repaired; this note supersedes their
open implementation status above. Current-source baselines retaken; release candidate checks follow.
