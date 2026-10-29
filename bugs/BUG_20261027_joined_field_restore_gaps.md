# Joined-field restoration: measured defects and remaining gates

27 October 2026. Owner: T607 / Codex. Local preview only; no landing or deployment.

John rejected the compact separated-unit appearance, selected the production joined
value/unit appearance from his Driver screenshot, retained ⚠ outside left and ≠W outside
right, and said “do it”. Wholesale adoption of the draft catalogue remains paused;
use cases still need John's approval.

## Reproduced and repaired

- The compact draft separated units from the outline and reduced readonly boxes to108px.
  The new joined contract failed before edits (`105956`), then passed with production-width
  170px grey Driver boxes, native readonly inputs and attached unit caps.
- A first restoration reserved the model cue track only on affected rows. Closed Box boxes
  and spinners consequently zig-zagged. Personal same-project screenshot comparison and
  Argon both exposed this. New DOM edge test red `111301`, focused green `111510`.
  One cue track is now reserved across the phone page. Using14px of the former16px right
  margin leaves160px joined boxes at374px, uniformly; cues remain outside after the buttons.
- Restoring16px production number insets and an outside cue initially clipped precise PR
  Vas/Fpr at360px. The existing glyph detector reproduced the actual text/unit collision
  (`111714`), then passed both360/374 widths (`112022`) after the common right-margin repair.
  Precision was retained; values were not rounded to conceal the collision.
- A grey unit cap could cover a mandatory/DQ/invalid input outline while old perimeter
  checks accepted any covering painted border. Strengthening top/right/bottom colour and
  thickness comparison on both skins reproduced Driver/Editor errors (`111419`). Shared
  outline state then passed (`111510`). The detector checks actual paint-stack coverage.
- Cursor ink/timing tests could pass while the inverse marker missed the digit by the
  difference between1px and2px borders or the old/new number inset. The cursor detector now
  measures the marker against native input border+padding+prefix text width−scroll offset.
  Red `111419`, focused green `111510`; the same detector exposed sheet failures (`111714`,
  `112022`). Tune/What-if native focus-border alignment is green `112105`.
- Moving ⚠ visually to the left did not move it before the number in Tab order.
  New visual-order keyboard test red `111911`; warning DOM placement repaired and green
  `112022`, then final complete joined/native-inventory group20 cases green `112858`.
- A precise vented tuning value and long Driver Editor units did not fit the first joined
  desktop layout; the shared content detector caught them (`110226`, `110648`). Numeric
  space and fixed-symbol sizing repaired; focused editor checks green `110847`.

## Why the previous tests did not establish conformance

Bounding rectangles alone do not prove visible text fits, an outline remains painted,
its colour/thickness continues under a unit, or the digit marker covers the actual glyph.
A source-grep architecture test can pass while obsolete CSS it matches is overridden at
runtime. Cursor text/timing can be correct while geometry is wrong. Styling tests can also
perfectly enforce a rejected appearance. These are separate failures; no bitmap baseline
is required to catch them. Existing complete-inventory and glyph/paint checks remain useful
and are preserved. Their coverage is bounded to their declared fixtures and states.

## Verification and honest limits

-195 browser cases passed in the broad joined/content/border/cursor/interaction run
  `111714`; its3 failures were repaired with focused passing cases `112022`/`112105`.
- Final joined controls and independent phone inventory:20 passed `112858`.
- Desktop clipping ancestors at1024/1280, action/diagram separation and splitter:4 passed
  `112045`.
- Preserved spinner/validation/PR seed/sheet domain checks:158 passed `110356`.
- Broader preserved behaviour run135 passed `110924`; its sole failure was an obsolete
  span-only readonly locator. Native-input locator retained the width assertion and passed
  `111141`.
- Sizing/unit/readout architecture:5 passed `112904`.
- Typecheck `111816` and changed-files strict lint `111841` passed before final prose.
- Same saved preview project survived bundle replacements; final local load1064ms,
  15requests, no errors/development imports. This is a browser check, not John's own-phone
  confirmation. No projects/settings were cleared.

Four exact old-draft assertions were deliberately run and remain red in `112705`:
`field-catalogue` numeric forms, `field-renditions` full exact numeric paint,
`mobile-unit-buttons` Signal fixed paint, and `unit-label-underline` Driver unit paint.
They require108px values/separate48px units and the discarded draft palette. They have
not been skipped, deleted, weakened, or reported green. Reconcile their independent paint
reference with the selected appearance and approved cases before landing. Broader full
migration/complete state conformance remains an open paused objective, not achieved by
these bounded repairs.

## Visual evidence

`build/ui-contract/joined-boxes-v1/index.html` contains eight same-project captures:
production, live test, rejected local draft and final restored local preview, Closed Box
first then Driver. Each picture has its own comment composer. Source/project identities
are recorded; remote deployed commits are not inferred from the local recorder checkout.
The local missing cloud icon is a build configuration difference (no Google OAuth client
ID), which also gives the project title more room. It is not claimed as a beneficial
field change. Normal pictured fixtures have no DQ warning; simultaneous-cue DOM and
catalogue checks cover placement, but the screenshots alone cannot prove that state.

Gemini strategy/source criticism, source/image review and follow-up are preserved under
that artifact folder and docs/design/reviews/T607-argon-joined-field-review.txt.
The follow-up personally verified the final images and source and found no concrete
blockers in the selected restoration. It accepted equal readonly/editable widths as
intentional conformance to John's Fpr-with-mass requirement. It did not independently run
tests or approve all prototype cases.

Additional review repairs: a Temperature-shaped warning label and a doubled stepperless
cue gap reproduced red113350; fixes plus the broader label detector passed143 cases in
113433, which exposed three desktop tuning-label descender overflows. Corrected legacy
line height, two-pixel cue gap and long-label geometry passed nine targeted cases113832.
The Driver readonly typeface was independently measured on production as Inter,15px,
normal400,22.5px line height; red113526 and green113601 preserve it on native inputs.
Actual clearing of mandatory Fs passed joined-outline checks on both skins114406.
Final cold mobile-style load:9576ms at200ms latency/50KB per second,15requests, no errors
or development imports; final saved-profile restore1059ms. The gallery has eight loaded
images, eight text composers, no errors and no horizontal overflow.

The paused catalogue still needs explicit approval and reconciliation of its exact old
paint assertions. The dormant inline DQ-marker guard and general renderer/style ownership
cleanup noted by the strategy review remain deferred; no claim about every possible
future caller state is made. No claim of
full test-suite success or final use-case approval is made.


## Automatic typography coverage (John, 27 October)

John requires automatic tests to catch font changes; AI image criticism is supplementary.
The previous Driver assertion checked only the first readonly input's computed family.
The geometry detector measured whichever font the CSS selected and therefore accepted
substitutions that still fit. It did not enforce size/weight/style/spacing/line height, or
prove that the named font had loaded.

New controlled substitutions on Xmax (the LAST of five Driver readouts) reproduced six
misses in the shared content detector: family, size, weight, style, letter spacing and line
height (red123938). The shared detector now checks every visible phone readonly numeric
input against independently measured production Inter15px/400/normal/22.5px/normal spacing.
It waits for font loading to settle and requires an actual loaded regular Inter face covering
digits, as well as FontFaceSet.check. That check by itself accepts undeclared font families.
Deleting Inter @font-face declarations while leaving computed font-family unchanged now
flags all five readouts, without network errors or screenshots. Seven cases pass124127.
The initial aborted-download probe also failed the fixture's existing automatic network/
console checks; the final silent-missing-declaration case isolates the previously uncovered
fallback case. Existing network guards remain unchanged. No errors are suppressed.

These assertions are part of measureFieldContent, so its existing page fixtures also enforce
the profile whenever they encounter phone readonly numeric controls. This change adds tests
only; no app CSS, preview bundle or appearance changes. Desktop, labels and other typography
roles do not acquire an invented global font standard. The broad visual audit remains cancelled.

Verification closure: all65 selected existing shared page/box-type cases pass124214,
readout wrapper architecture passes124339, typecheck124131 and changed-file lint124134 pass.


## Test-deployment reference reconciliation,27October2026

John accepted the607mobile appearance and requested a Test deployment; he has not reviewed
desktop yet. The old independent prototype oracle was red173753. Frozen paint and context
geometry were captured from the actual selected bundle v20261027T1419Z, not application CSS
or the app currently under test. Desktop metadata explicitly records observed candidate status,
not final user approval. The historical interaction HTML is preserved.

The exact comparisons, unit ownership/semantics, containment and controlled mutations remain.
The catalogue and real contexts now compare against their selected widths/joined unit edges,
not the rejected universal108px/separate48px policy. Full affected families:160pass175338;
three old-palette assertions were then corrected to the frozen selected E/C colours and those
plus the one-channel mutation pass175708. Quarter-pixel width mutation passes175240 after
preventing flex growth from cancelling the mutation. No test was removed or skipped; no app
appearance was changed to satisfy the obsolete oracle. Landing/candidate CI still required.
