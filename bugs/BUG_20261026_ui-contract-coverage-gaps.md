# UI standards are not enforced for every control and state

**Status:** OPEN — specific live defects reproduced and repaired in T607; broader inventory/state coverage remains incomplete.
**Reported by:** John, 26 Oct 2026.
**Audit source:** checkout HEAD `1180b4598ac12d8785cc54745fa2bab40c2adae4`;
this does not identify either live site's served build or the unlanded T606 worktree.

## Initial report, before live reproduction

John reports that live test differs badly from production, including missing borders and
overlapping values. Earlier agents repeatedly described broad UI sweeps as evidence of visual
and functional correctness. These observations are user reports, not fresh browser measurements
by this audit. The affected project, screens, browser, viewport and served build IDs have not
yet been captured together. No claim is made here that a fix is deployed or that the exact
reported live defects have been reproduced.

## Expected

Every control must meet the approved visual and functional standards in its supported states.
Tests must measure rendered DOM geometry and computed styles, exercise user interactions, and
fail when an expected control or an applicable check is missing. Screenshots support human
review; they do not replace these assertions. Production provides a comparison, not the
definition of correctness.

## Verified findings in the inspected tests

These findings describe the named tests, not an assertion that the entire repository has no
border or overlap tests. There are existing checks of both, but their scopes are limited.

### F1 — The phone row sweep can silently omit controls

`packages/ui/test/ui/phone-classic-rows.browser.spec.ts` collects rows through particular
classes and searches each row for particular input/readout/select descendants. Its three
box-collection loops use `if (!input) return []`. A changed or unsupported control disappears
from the measured set. A positive total count does not prove that every expected control was
measured. Wizard box checks also allow an empty box collection without an identity inventory.

**Required closure:** expected control identities per screen/state, classification of every
rendered control, and failures for missing, unexpected, duplicate or unmeasured controls.

### F2 — Missing borders are outside the row sweep's assertions

The phone sweep measures row heights, value left edges, padding, chip containment and selected
overflow conditions. It does not assert border styles, widths or colours on those controls.
Removing a border while retaining those measurements need not fail it.

Border checks do exist elsewhere. For example,
`packages/ui/test/ui/mobile-num-stepper.browser.spec.ts` checks the top border of the Signal
tab's Rs input. That check does not establish that every edge of every required border exists
on every screen. `desktop-alignment-unit-control.browser.spec.ts` checks selected border
properties on two alignment readouts, not a complete border contract for all controls.

**Required closure:** approved border rules per control/state, including each required edge,
style, width and colour; apply them to the full control inventory. Prove a required border
removal fails. Explicitly allow intentional shared edges and borderless controls.

### F3 — Overflow and containment are not proofs of no overlap

The phone sweep's `chipInside` accepts a chip anywhere inside the input rectangle. It does not
test separation of the unit text from the value text. Two items can overlap while both stay
inside the same box, and neither needs to increase `scrollWidth`. Likewise, two rows can paint
over each other without causing page overflow.

**Required closure:** measure intended text regions and relationships among values, labels,
units, steppers, badges and warning/deviation cues, including long values and wide units.

### F4 — Existing collision checks have narrower scopes than universal UI correctness

`original-shell-layout.browser.spec.ts` compares rectangles of `.field` wrappers, checkbox
labels and hints. It does not compare every descendant inside those wrappers, so an internal
value/unit collision is not established by a clean wrapper comparison. Its helper has no
per-pane assertion that all expected controls were matched.

`unit-label-underline.browser.spec.ts` does check unit placement and cue/value, cue/unit and
cue/cue intersections on listed screens. This is useful existing coverage. However, numeric
rows without its recognised numeric descendant are omitted. For input controls it models the
text area as the padded content rectangle; it does not measure actual input glyph extents.
Its geometry loop does not test every possible pair, and its screen fixtures do not actively
exercise every unit, long input, warning, focus and invalid-value state combination.

**Required closure:** retain these useful assertions, account for every applicable control,
and extend coverage to the missing relationships and supported states. Reproduce John's
specific overlap before attributing its cause to any one gap.

### F5 — Label-fit checks do not establish unobscured visibility

`original-field-labels-uncut.browser.spec.ts` checks `scrollWidth > clientWidth` on selected
labels. It does not measure clipping by ancestors, coverage by siblings, vertical clipping or
actual pointer reachability. Its cut-label loop has no expected-label inventory, so losing all
matching labels can produce an empty success result.

**Required closure:** expected labels, horizontal and vertical text bounds, clipping ancestors,
and occlusion checks at relevant points after normal scrolling.

### F6 — Desktop sizing coverage is limited to selected screens and properties

`desktop-control-sizes.browser.spec.ts` checks stepper sizes on Box and a wizard step, plus
selected wizard and Options footer dimensions. Its centre hit test applies to stepper buttons.
It does not establish all controls' typography, borders, alignment, text fit or behaviour
across all desktop tabs and dialogs. A centre hit test alone does not establish visibility or
reachability across the entire intended target area.

**Required closure:** shared assertions applied to every applicable desktop control and state,
with explicitly declared exceptions.

### F7 — The numeric sweep can pass despite unchecked fields

`num-input.browser.spec.ts` returns zero for hidden/uneditable inputs, empty or nonnumeric
starting values, and raw number inputs whose DOM stepping rejects the operation. Its final
`checked > 12` guard does not prove coverage of each expected numeric field. The named
all-box-types sweep enumerates sealed, vented, passive radiator and bandpass4; it does not
enumerate bandpass6 or ABC there. Its native-input branch calls DOM stepping methods directly,
which does not prove that the user's on-screen stepper interaction works.

**Required closure:** identify fields and states explicitly, distinguish legitimately
inapplicable cases from missing coverage, and exercise actual keyboard/pointer interactions.

### F8 — Functional tests do not imply every control satisfies its behaviour contract

The inspected NumInput and unit-toggle specs contain useful checks of precision, validation
and conversion. These representative checks do not prove every bound field updates the
correct result or persists correctly. Geometry-only sweeps cannot detect a correctly sized
control that writes the wrong value or fails to update its dependent result.

**Required closure:** map each control to applicable behaviours: valid/invalid/blank entry,
commit/cancel, keyboard/stepper operation, unit conversion, read-only/disabled state, warnings,
dependent visible results and save/reopen where relevant. Check expected outcomes, not merely
that a click completed or a value changed.

### F9 — Component/source checks cannot prove rendered conformity

`architecture-original-shell-uses-field-rows.test.ts` rejects selected hand-built control
patterns in the shell source. Using the shared component is useful architectural evidence,
but page CSS, data and state can still make its rendered controls violate the standard.

**Required closure:** retain source checks and pair them with rendered contract assertions.

### F10 — Screenshot baseline agreement is not approval of the UI standard

`visual/visual.browser.spec.ts` compares captures against committed images.
`scripts/visual/update.sh` regenerates those images and records the UI source hash. Thus,
agreement with a newly captured baseline alone cannot establish that a layout is correct.
This is a limitation of that evidence, not proof that a particular bad image was accepted.

**Required closure:** expected visual rules independent of the observed CSS, plus explicit
review of intentional baseline changes. Do not redefine the standard by copying current
computed styles or automatically accepting current images.

### F11 — Local suite success is not evidence about the live test build

`playwright.config.js` sets the standard suite's base URL to a localhost test server. It does
not establish which build John's browser received from test or production, or whether his
project and settings match the fixture. The earlier supplied session transcript explicitly
acknowledged that live production and test had not been compared with the same project.

**Required closure:** run the same measurable checks against both live sites using the same
project, settings, screen and viewport; record served build IDs and relevant browser/worker
state. Preserve the standing requirement for annotated live before/after pictures before
claiming a change is in test. No deployment/cache cause is asserted without reproduction.

### F12 — The inspected tests do not demonstrate that representative faults are caught

Their assertions do not include deliberate faults proving detection of a removed required
border, an omitted expected control, a value/unit collision or an incorrect value update.
This audit did not establish the absence of every possible fault-injection test elsewhere.

**Required closure:** demonstrate that each representative fault causes the appropriate
assertion to fail, including missing selectors. A positive control count alone is insufficient.

## Follow-up checklist

All remediation below remains OPEN; this record implements no test or UI fixes.

- [ ] The affected test screens MUST reproduce John's missing borders and overlapping values when opened with his project and settings. Evidence: live measurements, build IDs and annotated comparison captures.
- [ ] The controls MUST retain their approved borders when shown in each supported state. Evidence: full inventory checks and a failing removed-border probe.
- [ ] The values MUST remain separate from units, badges and warnings when long values and wide units are displayed. Evidence: geometry assertions and a failing overlap probe.
- [ ] The labels and controls MUST remain readable and reachable when their panels are scrolled or resized. Evidence: clipping, occlusion and interaction checks.
- [ ] Every expected control MUST be present and checked when its screen and state are opened. Evidence: missing, unexpected and unclassified control failures.
- [ ] The numeric controls MUST show the correct result when edited, stepped, converted, refused or restored. Evidence: per-control behaviour coverage and a failing incorrect-update probe.
- [ ] The saved project MUST retain accepted edits when reopened. Evidence: user-driven save/reopen checks for applicable controls.
- [ ] The test and production screens MUST report their measured differences when the same project and settings are opened. Evidence: common DOM report with verified build identities.

## Why green tests can coexist with the reported defects

The tests assert selected facts about selected elements in selected fixture states. Missing
borders are not among many of those facts. Containment and page fit do not imply separation
of values from adornments. Some selectors omit unrecognised controls, and minimum totals
permit incomplete coverage. Other tests cover specific borders and collisions, but are not
applied universally. Baseline agreement and local build success do not fill those gaps.

The particular cause of John's live defects remains unverified. No new browser tests or
live-site comparisons were run for this logging-only audit.

## T607 follow-up, 26 Oct 2026

The same-project live comparison subsequently reproduced the reported mobile closed-box
Fsc/Qtc overlaps and missing Re borders on Driver and Driver Editor. The separate issue
records describe causes, failing general DOM checks, their application across other screens,
fixes, and Gemini-driven findings:

- `BUG_20261026_mobile-closed-box-values-overlap-cues.md`
- `BUG_20261026_fixed-unit-backgrounds-cover-field-borders.md`
- `BUG_20261026_visual-review-exposes-unit-and-control-regressions.md`

The initial audit's statements about live reproduction above are historical, not the final
outcome. `tasks/T607-progress.md` contains final verification evidence. The annotated gallery
records production v20261025T2233Z, test v20261026T1705Z, and the normal local fixed build
v20261026T2119Z. The fixes have not been deployed.

The new general checks address the demonstrated glyph overlap, unit fit, painted perimeter,
unit surfaces/dividers/sizes, numeric-content fit and adjacent hint clipping defects. They
fail on unrecognised value controls inside recognised field rows. They do not yet provide
a complete expected identity inventory of every UI control, every error/focus/unit state,
every viewport or browser, or functional interaction coverage for every control. F1–F12
therefore remain a broader audit rather than a universal certification. No bitmap baseline
was updated or accepted as proof of these fixes.


## Argon-requested current-branch audit,27 October2026

Source checkpoint10fbfcca3, normal served task preview http://lap:4607,374×705.
The existing measureCompactFields checker was run unmodified on all44 numeric catalogue
rows with an independent intrinsic table for Qms,Fs_hz,adv_AirDensity_kg_per_m3 andpr_Num.
This is a controlled detector probe, not an application defect caused by user interaction.

- Positive baseline:44 rows measured, no issues.
- Remove both required spin buttons and the model cue from the writable unitless both-cues
  specimen: still44 rows measured, no issues. The checker checks location only for parts it
  finds; it has no independent expectation requiring these parts to exist.
- Also change that row's access attribute to readonly and set the native input.readOnly=true:
  still no issues. Expected access is obtained from the mutated row.dataset.access, so a
  coordinated wrong binding passes. Provenance/paint changes are outside this helper's checks.

Reproducer: /tmp/T607-argon-false-negative-probe.mjs (temporary). Full structured result:
build/ui-contract/argon-false-negative-probe.json. The probe calls the actual unchanged
TypeScript helper compiled for the live browser; it does not reimplement the detector.
No application source, imported project, production/test site or reference was changed.

Required general regressions: independently declare expected control identity/access/required
parts for each scenario, reconcile whole row presence, and require named failures for removed
spinners/cues, coordinated fake access and whole-control disappearance. A positive row count
and all found rows measured do not close these failures. OPEN until red→green proof exists.


### Refused draft leaves its inverse marker visible after focus leaves

Confirmed normal preview10fbfcca3 after first-run splash/storage notices were handled using
normal controls. In the actual writable Qms catalogue specimen, enter0 and choose its digit.
The refusal correctly says Qms must be greater than0. Click the gallery heading: the native
input is no longer focused, the refused0 remains (correct), but the inverse marker also remains
(incorrect under John's explicit lose-highlight-on-blur instruction). Probe before/after:
marker count1→1, input focusedfalse, refusal unchanged. Mechanism: NumInput-hooks.ts onBlur
returns early when refusal is nonempty, before clearing underlineIndex. Existing blur-marker
test covers only an accepted value. Add the refused-draft case without changing the retained
refused text/value policy. OPEN.

Structured evidence: build/ui-contract/argon-refusal-blur-probe.json. Temporary reproducer:
/tmp/T607-argon-refusal-blur-probe.mjs. Initial probes were blocked by the first-run splash
and storage notice; their timeouts were setup failures, not evidence of field behaviour.
Both were explicitly handled before the successful measurement. The detector mutation probe
was also repeated after dismissing those overlays and retains the same three false passes.

Permanent regression now reproduces the refused-draft marker defect in the built test app: num-input-rendition.browser.spec.ts, test "a refused draft retains its text but loses the digit marker when focus leaves". Red log20261027-054412-3082670: expected0 markers, received1; retained text/refusal and native blur pass. No implementation change yet.


### Focus-loss repair verification

Refused-draft marker regression is now repaired on the task branch only. Common onBlur
cleanup clears the marker and cancels repeat before the refusal early return; moving to the
field's own spinner buttons still returns earlier and preserves its draft/chosen digit.
The refused text and explanation remain. Same-project Closed Box captures at374×705 show
production v20261025T2233Z, live test v20261026T2106Z and repaired branch marker counts0/0/0,
with the immutable branch-before capture at1. Every capture has zero page errors.

During the first repair iteration I deleted the old trailing cleanup along with its timer
stop. This introduced an accepted-field held-repeat regression in that draft; it was not a
pre-existing accepted-field bug. A fractional-place hold test initially passed because blur
reformatted away the selected fractional index. The strengthened regression selects the ones
digit, proves the first step11.0000, then catches continuing11.000→14.000 after blur
(red055333). Final common cleanup restores cancellation and both new regressions pass.

Final targeted browser run055426:24/24 pass, including existing own-spinner focus, draft,
carry/end-caret, keyboard and touch cases. Unit refusal/pin checks055731:13/13 pass.
Full typecheck055452 and exact changed-source/test lint055451 pass. Review gallery:
http://lap:8000/winisd/openisd-t607/build/ui-contract/closed-box-focus-v1/ . Four images,
four per-image comment composers, zero page errors and no horizontal overflow verified at
374px and1280px; an unbroken SHA initially overflowed the review page and was corrected.
The broad independent-inventory, missing-parts and fake-access findings remain OPEN.

Focused Argon recheck accepts the blur repair only. Its additional refused-repeat coverage request is now satisfied by the new floor-state case (060127 pass): the marker remains absent after1000ms even while the numeric value is clamped0. Final typecheck060227/lint060224 pass. Broad coverage findings remain open.


## Independent scenario inventory progress,27 October2026

Red061328: removed Closed Box spinners, removed model cue, and coordinated readonly
metadata/native mutations each pass the old compact checker and fail the new permanent
negative regressions. A replacement fieldInventory checker now requires separately declared
field occurrence, native editor/access, visibility, options and every named unit/cue/spinner.
It reconciles raw value controls as well as registered rows and rejects duplicates, unknown
controls, missing identities and zero audits. Expected access is not taken from data-access.

Initial full run061620 exposed a false positive in my declaration: Qtc's empty unit slot is
explicitly display:none under field-catalogue.css:25. The scenario now declares that slot
hidden/noninteractive and requires real units visible; the check no longer assumes all parts
must be visible. Closed Box phone/desktop baseline plus11 mutations pass061838 (24 cases).
Additional red062242 catches two first-draft gaps (undeclared inner button, disabled spinner)
and proves the old catalogue checker measures44/96 forms. Those gaps are now repaired.

Current declarations account for all96 prototype catalogue forms across10 editor families,
plus complete Closed Box (both skins), Driver, Signal and Allpass phone surfaces. The same
unit-removal mutation is rejected on each new real page. Allpass initially expected no model
cue; the documented OriginalFiltersAPI contract states the cue is model-level regardless
of order, matching John's instruction, so its independently declared count is1. Full targeted
regression064757 passes69 cases, including old geometry/page checks and the primary numeric
paint test, which now enforces the complete inventory before measuring paint.

This closes the demonstrated false negatives in these declared scenarios, not every host/state.
Paint outside the44 numeric forms, transient states and most real page inventories remain
incomplete. The older compact geometry helper's self-reported binding access is not independent
semantics proof; its comment now explicitly requires the new inventory check alongside it.

Source discovery at4ccd49f9a with no application-source patch found152 value/action-input
or semantic-role declarations across92 Vue templates:134 host/component declarations need
family/ownership reconciliation,6 are action/hidden inputs,3 are shared numeric primitives,
and9 are catalogue prototypes. One dynamic element is retained for explicit review. These
are source declarations, not runtime counts (loops expand them). JSON evidence:
build/ui-contract/control-source-inventory.json; reproducible script:
scripts/audit-field-control-sources.mjs. The first parser attempt used compiler-core defaults
and rejected HTML void inputs; corrected to Vue's DOM-aware parser before recording evidence.
No source parse error is being attributed to the app.


### Inventory review and second independent probe

Argon's inventory review completed exit0 and identifies remaining false-success paths:
self-owned select elements do not audit their row siblings; labels and option labels/states
are not declared; opacity0 duplicates are filtered out; inert/ARIA/tab suppression is not
checked; decoy spinner selectors can overlap; real-page cue types are weaker than catalogue
cue types; bug-toggle markers and readonly renderer distinctions are not required; fixed
base-form cardinality and readonly/custom source declarations need stronger checks.
Full report: docs/design/reviews/T607-argon-inventory-review.txt. A separate live probe
confirms changing the Box type option label or disabling the option still yields no issues
(baseline and both mutated inventories account1/1). Structured evidence:
build/ui-contract/inventory-option-false-negatives.json. These are controlled checker
mutations, not newly introduced application rendering faults. Regressions are being added
before repairing each verified path; disagreements/limits will be recorded explicitly.


### Review-driven inventory closure evidence

The12 additional host mutations fail on the old draft (072211), and4 bug-toggle/readonly/DQ
renderer mutations fail072757. Repaired inventory073006 passes96/96 targeted cases. Owner
selectors now identify full field containers; all required labels and real cue buttons are
declared. Select option labels and effective disabled state, checkbox state, native tab
suppression, inert/ARIA blocking, opaque duplicate layout boxes and loose known parts are
checked independently. Spinner selectors require the same actual buttons, not disjoint decoys.
Readout and bug-switch signatures are distinguished;96 is pinned independently of producer
length, with a per-family domain regression. These remain prototype/current-host declarations,
not approval of other catalogue cases or complete all-host/all-state paint/behaviour proof.

Source audit fixes retain standalone readonly spans and opaque object bindings. Expanded
source report:154 declarations and265 value-component uses, with1 dynamic element,1 dynamic
semantics binding and5 opaque spreads. The original152-count report is preserved separately;
latest output carries exact template/generator fingerprints and an immutable snapshot link.
A missing-label-for association on legacy raw fields and plain spans versus native readonly
reference semantics are not certified by this inventory; canonical-renderer migration and
accessibility/interaction tests remain required before full conformance can be claimed.


27 October final inventory recheck: Argon materially closed the five major detector findings.
Its ordinary-checkbox/bug-switch residual is now independently reproduced (080822,2 failed)
and repaired (081159,7 passed including96-form baseline and six renderer mutations). Unit
family-cardinality guard081224 passes3/3. The spinner Tab finding remains open: current app
buttons already have tabindex=-1, so the suggested -1 mutation is a no-op, but native focus
still differs from the reference. Driver readonly spans are accounted legacy renderers, not
approved replacements for reference inputs. This remains an open coverage/migration bug.


Final Argon bounded report T607-argon-inventory-final.txt confirms checkbox closure and
retains these open coverage/migration findings: spinner type/tabindex and native Tab flow;
actual DQ-present page states; text/readonly choice excluding numeric wrappers; Allpass
ordinary-checkbox identity; readonly Driver reference inputs;52 nonnumeric exact-paint forms
and complete host/state reconciliation. Its source-only underline inference is corrected by
the active field-catalogue.css:83 inverse animation override. No new visual claim is made.


Native keyboard repair checkpoint: three native Tab cases fail081939 and pass082250;
spinners are naturally tabbable, unit DOM order precedes buttons, group draft/selection
is retained until true exit. Closed Box both-skin host checks pass082356. Two detector
mutations fail082318 and now enforce button type/Tab attributes. The136-case affected
run has135 passes082356 and1 strengthened end-caret case passing082625.57 domain/
architecture checks pass082411. Actual before/after and remote production/test are
preserved in closed-box-native-tab-v1 with individual comments and honest source metadata.
Argon code/image review is pending. Full conformance remains unproven and open.


Argon keyboard follow-up: actual hold-transfer defects reproduced083505/083612 and fixed;
unit-place marker reproduced083847 and reset; reverse-Tab native select-all regression
exposed084004 and fixed. Focused6 pass084253; final affected93 browser cases pass084350.
The spinner-first entryValue/unused blur-notify contract remains open, together with inverse
blink green phase and mandatory overlay inset, readonly/native migration and full host/form
coverage. Alternative noncompact scoped styles are dead-path debt on the always-compact
branch and must be removed with canonical style ownership, not preserved as a second look.
Original image attribution is corrected: Vb/Fsc pixels did not resize or shift. Final fresh
capture and an independent focused Argon code/4-image recheck are recorded/pending.


Argon recheck confirmed bounded fixes/4-image attribution and found the null-marker
reverse-Tab edge; red085015 now has exact selection/spin coverage and a repaired fallback.
Final affected94 browser cases085059,57 targeted unit/architecture084709, typecheck085202
and final hook/test/publisher lint085158 pass. Final independent edge recheck is pending;
all broader coverage/migration/provenance items remain open.


Final Argon caret recheck confirms scoped keyboard closure. It notes pointer re-entry on
sign/decimal currently falls through to the final-digit fallback; add an exact pointer red
before repairing this next. This is tracked separately from completed native Tab tests.
No broad appearance/behaviour/deployment claim is justified. Full goal remains active.
