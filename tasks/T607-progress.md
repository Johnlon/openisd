# T607 — closed-box then Driver UI contracts

Worktree: `/home/john/work/winisd/openisd-t607`. Current requested preview: http://lap:4607/ (restored bundled preview; served build v20261027T1138Z). Fixes are local; nothing has been deployed. Initial fixes/audit checkpoint committed as `5351a1ddc`.
The original twelve-finding audit is committed as `c905105f3` and remains open for broader
control inventory, supported states and functional coverage.

## Required order and evidence

- [x] The closed-box page MUST show matching project data when production and test are compared. Evidence: identical project SHA, sealed selection, 374×705/1280×900 viewports and served-JavaScript build IDs in saved JSON records.
- [x] The closed-box values MUST remain separate from difference buttons when the phone page is shown. Evidence: actual Fsc/Qtc failures before source edits, `20261026-195457-2254328.log`; production passes the same detector.
- [x] The other pages MUST keep values separate when the same content check is applied. Evidence: unchanged check on 57 cases before viewing other images, `20261026-195611-2257996.log`; it finds phone Advanced collisions, followed by 59 green cases in `195829-2266111.log`.
- [x] The Driver page MUST retain visible outlines when fixed-unit labels are shown. Evidence: production passes and live test fails Re top/bottom; worktree red `20261026-200437-2293859.log`, followed by the general border sweep.
- [x] The other screens and Driver Editor MUST retain their borders when the unchanged border check is applied. Evidence: `20261026-200530-2334294.log` and corrected foreground/geometry setup in `201142-2368371.log`, still failing real covered-border defects before the source fix.
- [x] The comparison pages MUST show only the requested views when images are inspected. Evidence: only closed box, Driver and Driver Editor captures were viewed; other pages were tested through DOM measurements.
- [x] The displayed units MUST fit without covering values or steppers when the visual reviewer checks the first candidate. Evidence: Gemini inspected 18/18 and rejected v20261026T2021Z; expanded assertions fail four representative cases (`203402-2428710.log`) and 42/128 shared cases (`203559-2430900.log`) before further UI edits.
- [x] The Driver explanation and editor chips MUST remain readable and consistent when compound units grow. Evidence: Gemini rejected the second candidate; hint clipping and identical-unit-width assertions fail before fixes (`20261026-211403-2563495.log`) and pass afterward (`211510-2564986.log`).
- [x] The Driver Editor MUST show populated numeric values clearly when a narrow phone is used. Evidence: existing sweep fails at 360px; the new shared check reproduces gamma clipping and Rme/Mpow warning collisions (`20261026-211117-2558188.log`), then both regression cases pass (`211227-2561089.log`).
- [x] The desktop Box page MUST show its tuning frequency without clipping when full display precision is present. Evidence: the general check detects `35.90024611` needing 80.71px in 76px; final shared input padding provides 82px without changing its outer width or font.
- [x] The fixed pages MUST retain useful production behaviour when screenshots are compared. Evidence: I personally inspected all six final fixed views against production; the gallery explains every material visible departure and links measured style/geometry differences. Wider phone readouts, fitted compound units, continuous borders, consistent clickable chips, and complete wrapping explanations improve readability. No screenshot baseline update is used as proof.
- [x] The shared fields and phone controls MUST remain readable when the final DOM checks run across their supported fixtures. Evidence: 133 shared cases plus 160 existing phone cases pass, 293/293, `20261026-211940-2573803.log`; lint passes `212046-2576392.log`; typecheck passes `212223-2580141.log`.
- [x] The design column and unit appearance MUST retain their ownership when the named architecture tests run. Evidence: four relevant unit files, 12 tests pass, `20261026-212551-2589692.log`; earlier eight-file architecture/design pass is `210152-2535236.log` (57 tests).
- [x] The units and difference buttons MUST retain their interactions when conversion and existing control checks run. Evidence: 139 cases pass in `20261026-212547-2589428.log`; two incorrect style expectations are reconciled with strict transparency and actual full-cycle column/fit checks, both passing in `213125-2601665.log`.
- [x] The fixed pages MUST survive independent visual criticism when Gemini examines the final old/new images. Evidence: final Gemini report inspects 18/18 and approves v2119 with no remaining harmful visible deviations; first attempt was interrupted without critique and is not approval.
- [x] The comparison gallery MUST allow a reply under every picture when opened on a phone. Evidence: headless verification finds 18 loaded images, 18 figures, 18 comment boxes, zero missing boxes and zero page errors; no comments were posted.
- [x] The findings and fixes MUST remain recoverable when this session ends. Evidence: source and audit checkpoints `5351a1ddc` and `b6f5b43aa` committed with hooks enabled, verified clean source worktree; the review preview remains available because John explicitly requested to use it.

## Comparison artifacts

Gallery: http://lap:8000/winisd/openisd-t607/build/ui-contract/

Production is v20261025T2233Z, live test v20261026T1705Z, final normal local build
v20261026T2119Z. The local build uses production's public OAuth client identifier so cloud
controls match. Normal service workers are enabled and initially activated before import.
The project bytes are the same complete-driver fixture on every site. Build IDs are checked
in both build-info and served JavaScript. All six final views have zero field content/border
findings.

`build/ui-contract/comparison/` preserves first-round evidence, `final-comparison/` preserves
second-round evidence, and `reviewed-comparison/` contains the latest 18 raw PNGs, JSON DOM
records and six production-to-fixed DOM difference files. The first two Gemini reports remain
unchanged. Source patches for each review are saved separately.

## Findings and resolutions

The three separate bug records document glyph/cue overlap, painted-border occlusion, and
additional Gemini/general-test findings. The shared checker measures actual input text with
its rendered font/alignment/scroll offset, normal text with DOM Ranges, unit glyph bounds,
pairwise adornments, input content fit, unit sizes/dividers/surfaces, mandatory borders and
hint text against clipping ancestors. A declared border alone is insufficient: edge samples
inspect the actual paint stack. Recognised rows without recognised controls fail explicitly.

Fixed units are transparent. Clickable units own their appearance in UnitToggle; the source
ownership gate is retained. Compound phone columns are design-owned. Warnings occupy the
label rail. Desktop chips fit their own text, align with the control height and avoid subgrid
stretching; hints wrap in the remaining pane. Inputs keep production left alignment.

Two old tests required opaque white fixed-unit backgrounds, which encoded a visible defect;
they now strictly require transparent fixed labels while preserving grey clickable chips,
underlining and interaction assertions. No tests were removed or skipped.

A Gemini border-colour observation was contradicted by saved measurements: mobile Fs/Vas
input and chip both have `2px solid rgb(196,196,196)`. This is logged, and the checker now
compares covering mandatory chip border colour/thickness too. An intermediate clipping rule
incorrectly treated freeform scrolling project names as static numeric values; it now applies
numeric fit to numeric controls, retaining general collision checks for the wider inventory.
An interrupted broad run (`211552-2566031.log`) is not counted as passing.

## Limits

This is Chromium verification of named fixtures and six phone sizes, not proof of every
control/state/browser. All-control identity inventories and comprehensive functional-state
coverage remain open in the original F1–F12 audit. Local results do not prove deployment;
no claim is made that the live test site has these fixes.

## Additional user-reported selector regression, 21:33

- [x] The driver information MUST show the same aligned number and unit columns when reached through the wizard or the Driver area. Evidence pending: capture both routes with the same Tang Band driver on production, test and local, phone and desktop.
- [x] The driver summary MUST fail a general alignment check when its columns visibly drift. Evidence pending: run the existing parity check, reproduce the real defect in a shared rendered-summary checker, then apply it to both hosts and widths before fixing source.
- [x] The driver information MUST remain aligned and visually consistent when the fix is reviewed. Evidence pending: red-to-green tests, personal old/new comparisons and independent Gemini critique of the added view.

New issue: `bugs/BUG_20261026_driver-selector-summary-alignment-regression.md`. This extends
the ongoing task; the earlier six-view findings and green test evidence remain valid for
their stated scope. Nothing is deployed.

## Additional review reports, in order

- [x] The passive radiator MUST start with a populated, internally consistent dummy when a newly created sealed project switches to PR. Evidence pending: reproduce Qms empty and add a failing domain transition test before the seed fix.
- [x] The placeholder radiator MUST be named Dummy PR when the seeded radiator appears. Evidence pending: seeding/domain and visible UI assertions, replacing ReplaceMe.
- [x] The air-density unit MUST align with the other environment units when Advanced is opened. Evidence pending: same-state production/test/local captures, general edge-alignment red test, fix and wider row check.
- [ ] The warning and WinISD difference cues MUST follow the intended placement when either or both are present. Evidence pending: compare simultaneous-cue states against production/design; the current split was an implementation choice and John has not approved it.

John asked whether the split was intentional; answered yes with the collision-avoidance reason.
This is not treated as approval of the new layout. Earlier six-view Gemini approval does not
certify this unpictured simultaneous-cue state.

## Follow-up verification and current design boundary

The original evidence above remains historical; its pending fields are closed by this final
evidence section. The selector discrepancy was reproduced at 360/374/412px and desktop:
four cases fail before source edits, while 57 other screen cases pass (`214750-2617666.log`).
The existing 412px element-box parity test passes despite the real defect. The glyph-based
summary contract detects it, and 62 cases then pass (`214954-2621041.log`). Expanded summary
coverage spans all six phone sizes plus desktop and both routes; the six relevant browser
specs pass 90/90 (`220114-2642100.log`). Live selector records explicitly count 13 summary
rows; a zero-row UIField report is never treated as proof of summary correctness.

The PR domain tests separately fail name and missing Qms before the seed fix
(`215228-2626523.log`); the final 11 domain tests pass, including consistent derived values,
no mechanical DQ, preserved entered data and no invented Qms for named real radiators. The
real wizard path passes (`215748-2634112.log`). Air-density indentation is reproduced
(`215513-2628379.log`) and fixed; that regression came from my wide-chip rule.

The final field/unit checks pass 255/255 (`221350-2659020.log`), including actual simultaneous
warning/model-cue states at 360/374px. The first narrow both-cue test caught a further Cms
overlap (`220840-2651336.log`); the 60px chip rail and 4px cue gap repair passes targeted
cases (`221250-2655880.log`) before the broad 255-case run. Design, seed and ownership tests
pass 22/22 (`221353-2659259.log`). Final lint passes `222116-2681808.log`; full typecheck
passes `222422-2689368.log`. No bitmap baselines were used or updated as correctness proof.

I personally compared all follow-up views to production, including the new four-column
desktop summaries. There is no source deployment. The screenshot galleries distinguish
archived v2119, follow-up v2158 and current compact v2221, with build IDs and project SHA.
All 19 follow-up images and four first-trial images load with one comment box each and zero
page errors. The two newer stacked images also provide per-picture comments. The user
explicitly requested the app to remain accessible, so its dedicated preview stays running.

Gemini (agy, Gemini 4 Argon High) inspected all23 follow-up/trial images and judged the three
fixes beneficial and the first compact trial's precision failures honest. Its report has
incorrect code claims: `measureFieldContent(root)` has no `productionRects` argument,
alignment/divider checks are unconditional, fixed units were not given padding0 6px, and
summary nonnumeric label/glyph overlap is checked unconditionally. These were verified in
the actual source and saved DOM, and are not adopted as findings. The valid missing-both-cue
coverage criticism was addressed and found the real 360px collision. A final bounded
precision review is running against absolute file paths, so it cannot silently confuse roots.

- [x] The proposed cue order MUST show its space tradeoff when full precision is reviewed. Evidence: the compact prototype fails visibly; the 68px stacked-label prototype passes all12 fields at360/374px with Cms0.123456789 and both cues.
- [ ] The phone fields MUST preserve a long entered value alongside both cues after a layout is chosen. Pending John's preference: taller trial versus the current40px layout; no answer is inferred. Current compact full-precision failure remains explicitly open in the bug record and gallery.
- [x] The final spacing and trial MUST survive the last independent critique. Evidence: `build/ui-contract/gemini-precision-review.txt`, 10/10 images inspected by Gemini 4 Argon High; compact repair approved for the tested states, full-precision limit explicitly confirmed, taller prototype judged to fit both phone widths.

The source fixes are separate from the unapplied layout trial. No universal UI/state/browser
or arbitrary full-precision certification is claimed. No user comments were present on
QO305 when the comment thread was read before the latest page update.

## Final saved state

Source fixes and tests are committed in `b6f5b43aa` after the earlier `5351a1ddc` checkpoint;
the original audit is `c905105f3`. Final source typecheck passes
`20261026-222422-2689368.log`, lint passes `222116-2681808.log`, and the latest field/unit
run is 255/255 (`221350-2659020.log`). The two new both-cue states are part of that run.
The separate interaction/summary suite passes 90/90; unit/design/seed/ownership passes22/22.

The final independent review inspected all10 precision PNGs plus the actual absolute source
paths and confirms the repaired narrow case and the honest remaining compact-layout limit.
It judges the taller trial to fit the full values at360/374px. Its noted tradeoffs are fewer
fields onscreen and the still-inline select rows; no trial is applied by inference.

Current app: http://lap:4607/ (restored bundled preview; served build v20261027T1138Z). The user explicitly asked to use it, so the
preview remains running. Comparison pages and every picture's reply box are verified;
current precision and taller-trial pages have10/10 and2/2 images/comment boxes respectively.
No agent comments were posted. No source deployment or landing was attempted.

Outstanding: the asynchronous preference question about the 68px cue layout is unanswered.
The known long entered Cms failure remains open and shown in the gallery. This is a design
review boundary, not a claim that all control/value/state combinations are certified.

## New ruling and review scope

John explicitly rejected stacked rows. The earlier preference question is superseded; do not
apply the68px trial. Compact narrower rows, DQ outside left and model cue outside right are
the requested gallery direction. The catalogue is to be the sole appearance authority.

- [ ] The PR mass-loaded resonance MUST use the standard value-box width when shown with the other PR fields. Evidence: same-page read/write/readout width comparison before and after.
- [ ] An existing automatic placeholder MUST become a consistent Dummy PR when used on the current preview. Evidence: reproduce old ReplaceMe state, verify served build, add legacy-placeholder regression.
- [ ] A new dummy radiator MUST provide at least the active driver's swept volume when a project is created. Evidence: domain tests for active driver count, Sd and Xmax; preserve real/custom PR data.
- [ ] The Driver Editor speaker diagram MUST offer the existing thicker-outline rendition when reviewed. Evidence: source/history search and labelled gallery comparison.
- [ ] The field catalogue MUST illustrate every logically valid access/unit/cue form and relevant state when reviewed. Evidence: typed matrix, independent Argon criticism, per-specimen comments and conformance checker.
- [ ] The page gallery MUST show narrower compact fields with DQ left and model cue after the last control when each page is reviewed. Evidence: matched screenshots, glyph/border/row-height checks and short-label report.
- [ ] The AllPass Order model cue MUST hug its dropdown/control when shown. Evidence: actual Filter page gallery and adjacency assertion.
- [ ] The Tune and What-if driver/PR counts MUST use the same dropdown form and permitted options as the other pages. Evidence: Argon opinion, intrinsic-type test, interaction and domain checks.

Current investigation: the seed identifies only the new Dummy PR name; a pre-existing
Placeholder/ReplaceMe record can therefore retain its old name and missing Qms. This is a
hypothesis to reproduce, not an assertion that the user merely has a stale browser.

## 27 October: approval boundary and retained audit

John requested that the use cases be approved before adoption, and then requested one HTML
page with the controls directly on it. The 20-case proposal is published at
`build/ui-contract/use-cases/index.html`; its tracked source is `docs/design/field-use-cases.html`.
These are interactive prototypes for approval, not an adopted standard. Page-audit captures,
DOM records and failing sheet findings remain under `build/ui-contract/compact-pages/`.

- [x] A new sealed project MUST carry a consistent Dummy PR when created, including the chosen driver count. Evidence: original three domain regressions red at 000626; wizard count regression red at 000918; 74 tests green at 000951.
- [x] A legacy ReplaceMe dummy MUST receive its new name and Qms when a saved sealed project switches to PR. Evidence: saved-session regression red then green in box-starting-values. Already-active legacy-session automatic migration remains separate and is not claimed.
- [x] The PR mass-loaded resonance MUST share the writable numeric box width when displayed. Evidence: browser regression measured a 90px excess at 001132; corrected normal preview plus seven PR checks pass at 001736.
- [x] The Tune and What-if driver count MUST use the permitted native dropdown options and preserve their respective commit behaviours when changed. Evidence: two browser regressions red at 000757; nine sheet checks green at 001100. PR count shares the intrinsic renderer; its separate picker interaction case remains to be added.
- [x] The compact field checker MUST reject a wrong count editor, missing border, widened readout and inward model cue when deliberately introduced. Evidence: mutation checks pass at 002055.
- [x] The compact phone fields MUST keep number boxes narrow and cues outside when the six box pages, Driver, Signal, Allpass and Advanced are measured. Evidence: same checker, 13/13 at 002343.
- [ ] The Tune and What-if compact proposals MUST keep units outside narrow boxes when reviewed. Evidence: two genuine red tests at 002734; current 160px inputs and inside units remain open.
- [ ] The general text forms and raw selectors MUST receive explicit semantic coverage when the complete audit is finished. No zero-row report establishes their conformance.
- [ ] The use cases MUST receive John's approval before they become the sole appearance reference. Evidence pending: comments on the 20-case HTML page.
- [ ] Every matched page difference MUST be personally reviewed and independently criticised by Gemini before the newer gallery is called reviewed. Captures retained; review pending.

Argon design critique is saved in `build/ui-contract/gemini-catalogue-design-review.txt`. It
supports native count selectors and an independent registry-based editor oracle. It also
identified omissions in the initial schema. This is a design critique, not visual signoff.
The older thick dark outline was found in `e80081a8e:packages/ui/src/components/DriverEditorModal.vue`,
300×260 SVG with 1.5px dark strokes. The current shared drawing is 540×450 with 1.3px light strokes.
A labelled side-by-side demonstration remains pending; no replacement was silently applied.

Update after the HTML page was published: 20 cases, 20 live comment boxes, 374/360px layouts
and native spinner/count/unit/DQ/model-note interactions verified. No comments were posted
by the checker. The gallery-only sheet fix now passes the same compact checker; the expanded
run is 19/19 (`build/test-logs/20261027-003441-2820360.log`). The older failed captures remain
retained; they are not relabelled as fixed screenshots. No use case has been approved yet.

Final saved-check evidence for this checkpoint: HTML prototype verified at 374px and360px
with20 comment boxes and working unit/count/spinner/explanation controls; typecheck green
`20261027-004104-2828318.log`; lint corrections green `20261027-004029-2827657.log`
(the full lint identified only those corrected files); affected PR/empty-project cases54/54
`20261027-003716-2822860.log`; seventeen expanded catalogue/page cases green in
`20261027-004101-2828128.log` and the two sheet cases green after correcting their
coverage-oracle assertion in `20261027-004243-2830067.log`. The sheet numeric checker
measures5/9 actual numeric controls; General instead uses the text/border checker. Neither
is allowed to pass on an empty combined inventory. No layout approval or deployment is claimed.

## Use case01: selected place for spinning

- [x] The editable-number proposal MUST show which digit the spinners change when a digit is tapped or selected with the arrow keys. Evidence: all four live HTML variants passed pointer/keyboard selection,0.1/10/1 steps, decimal carry and persistent-marker checks; `/tmp/T607-spin-verification.json`.
- [x] The selected digit MUST remain identified by a steady underline, blinking underline, solid highlight or thin outline when the four alternatives are reviewed. Evidence: markers persist after spinner activation; 374px/360px rows fit. These are proposals; John has not chosen one. Each alternative has its own comment topic; existing case01 comments are preserved.

Interpretation stated to John: “unit selection for spinning” is selection of the decimal
place/digit, not rotation of physical display units. Changes are limited to case01 on the
HTML approval page; page-audit work and the normal app layout are retained.

Read John's saved review comments before finalising this update: case01 requests A/B/C/D
initial highlighting demos (QO305.c20–c30). Four alternatives are now included: steady
underline, blinking underline, solid fill and thin outline. Existing comment topics remain
unchanged; each alternative has an additional distinct topic.

- [ ] The model-difference examples MUST open a popup when their explanation is requested, as John specified in QO305.c7/c13. The current approval-page inline note remains to be changed; this is outside the current case01 edit.
- [ ] The ordinary and WinISD bug checkboxes MUST align when shown together, as John specified in QO305.c14. This remains open.

John marked case03 “clean” (QO305.c10) and case20 “good” (QO305.c16). Those individual
comments are preserved and recorded; they do not approve the remaining cases or choose a
digit-highlight style.

John prefers blinking underline and requests an inverse-blinking example. Added option E
(normal text alternating with inverse white-on-blue). Compacted option comments so all
styles appear before their discussion threads. Current active requests: share the existing
production spinner/validation logic with the HTML gallery; add desktop up/down and held
acceleration; archive and clear completed review comments while retaining open issues.

Archived and cleared 20 completed gallery comments/replies at John’s explicit request. Full original entries are saved in `docs/design/field-use-cases-comments-archive.json`; server messages are preserved. The approval notes for03/20 remain visible as approval labels. Open popup and checkbox-alignment feedback remains visible.

Gallery behaviour update: four genuine red checks reproduced on the live old page (desktop
ArrowUp, letters, malformed replacement, zero-boundary stepping). The new gallery imports
the production `spinStep`, `caretRepeatDelayMs`, `pressedDigit`, `typedEdit`, `pastedEdit` and
`entryRefusal` implementations through a small bundled bridge. No counter arithmetic is copied.
Active checks: keyboard from spinner focus, held acceleration/release, non-negative bounds,
invalid typing/paste, focus loss, optional empty versus mandatory empty, all five highlight forms.

John selected inverse video, provisionally phrased “I think”; the reference now marks E as
selected and places all five spin options at the very top of the document. A–D are retained
for reference. A Settings choice for cursor style and colour is recorded as an idea only,
not authorised implementation work.

Mobile selection correction: native one-character text selection opened copy/paste menus.
On coarse-pointer devices the five spinner alternatives now use a non-text touch surface
for choosing the digit and a separate Edit action for keyboard entry. Spinning never
focuses/selects native input text; explicit Edit enables normal typing. Desktop behavior
is unchanged. Both modes call the same production spin and validation functions.

John rejected placing Edit where the label belongs. Replaced the extra action with the
existing provenance-view soft-disable pattern: short taps select a spin digit, a400ms
long hold (the production CARET_HOLD_START_MS) enables numeric entry. At John's explicit
request, entering edit mode clears the old value. Applied this consistently to every
editable numeric gallery field on coarse-pointer devices, without changing its label.
Desktop entry remains immediate. Spin buttons still retain group-wide keyboard controls.

Latest ruling overrides the earlier clearing instruction: long-hold MUST preserve the value.
The soft-edit transition now keeps the exact current text, enables ordinary numeric typing,
and places the caret at the end. A short mobile tap shows the requested toast,
“Long-hold to edit”. No label space is occupied by an Edit action.

Reproduced apparent blanking in all A–E variants: the numeric value remained123.4500
through touch hold/release, but the original mirror-overlay CSS made native selected text
transparent, while edit mode hid the overlay. Selecting the text therefore painted an
empty-looking field. Restored visible white-on-blue native selection in edit mode. Evidence:
`/tmp/T607-all-preserve-results.json` and before image `/tmp/T607-inverse-editing-selection.png`.
The preserved-value logic itself is verified for all five variants.

Latest mobile UX ruling: long-hold opens a centred numeric popup instead of inline native
editing. The original field remains a spin control. The popup starts with the unchanged
value, supports normal Android text editing, uses the same numeric validation, and has
Save/Cancel. The popup follows the visible viewport when the keyboard changes its size.
This supersedes the earlier inline soft-edit transition; no Edit action replaces the label.
Production value-limit demos and written explanation have also been added to the same page.

Latest decision supersedes the long-hold/popup experiments: restore immediate in-place
mobile editing, as production does. A touched digit sets the spin position and focuses
the native input immediately. No Edit action, edit toast, edit timer or popup remains in
the behaviour. The native caret stays collapsed on mobile instead of programmatically
selecting a character; the inverse marker identifies the logical spin digit. Held spinner
acceleration, button-focused keyboard controls, validation and limits are retained.
The rejected experiments were committed first in fb861c0f5 so their work/evidence is safe.

Keyboard-close pinning: located the production StepperPin class and MobileShell/NumInput
adapters, with its existing T439 bug record and regression tests. Reproduced a150px gallery
jump after simulated keyboard expansion and a late browser scroll. The gallery now imports
that same class and visible-viewport helpers. It adds the temporary screen of space before
button focus closes the keyboard, holds for1500ms, and then only shrinks the space. The
HTML page supplies a document-scroll adapter rather than copying the ratchet logic.

John asked for an explicit cursor decision: E inverse video is now marked DECIDED and
moved first; A–D are individually marked DISCARDED and retained as reference. The gallery
otherwise stays intact. Mobile keyboard-close pinning remains under investigation because
John reports inconsistent movement, including E; the earlier “perfect” was explicitly
withdrawn. No phone approval of the pin is claimed.

## Exclusive-rendition app branch (John's active goal)

- [x] The gallery spinner MUST stay under the finger when the keyboard closes, including when native blur precedes a button press. Evidence: the all-row probe passed14 focused cases but failed the E blur-before-press path by116px; tracked browser regression added before the fix.
- open — The app fields MUST use the decided gallery renditions when any page or editor opens, including both skins and Tune/What-if. Evidence required: ordinary app pages without injected CSS, exhaustive control inventory and independent geometry/style checks.
- [x] The selected digit MUST use inverse video and the gallery's typing, stepping, hold acceleration and focus behaviour when editing through touch, keyboard or buttons. Evidence required: shared-control behaviour tests and page integration checks.
- open — The app fields MUST fail conformance when any approved border, dimension, alignment, colour, affordance, cue position or behaviour changes. Evidence required: independent expectations and deliberate mutation failures, exhaustive valid states and all page fixtures.
- open — The review gallery MUST show matching project screenshots and justified improvements when the branch is compared with production. Evidence required: build IDs, before/after pairs, personal review and Gemini visual criticism.

Gallery pin regression closed mechanically: tracked15-case browser spec passes, including all14 editable spinners after blur-before-touch (035237 log). Production pin/viewport unit specs12/12 pass (035320); full typecheck passes (035304). This is emulation evidence, not a physical-phone approval.

App adoption TDD: exact control paint comparison against the separate reference HTML fails before implementation: entered green is rgb(27,125,27) instead of the decided rgb(7,130,0) (035545 log). The branch now enables the shared compact renderer in the ordinary app; page tests no longer inject candidate CSS. Full exact-state and page verification remains in progress.

Branch created: t607-field-renditions. The normal app now enables the shared field renderer. Numeric catalogue paint/dimensions match the independent HTML for44 forms; all16 phone page/editor contract checks pass without injecting CSS (20 browser cases total,035857). The combined gallery and exact-paint checks pass16/16 (040111); pin/viewport units12/12 passed035320 and typecheck passed035958. The new test found a falsely labelled fixed-unit specimen using the switchable reference-density field; it now binds the actual fixed-unit environment-density field. These results do not yet cover all desktop pages, nonnumeric forms, every state, real Android keyboard behaviour or exclusive spinner behaviour; those remain open.

Spinner adoption: new four-case rendition interaction spec passes (040847): button-focused arrows, blinking inverse marking/focus loss, 400ms-to-accelerated held keys, and immediate touch editing with a collapsed native caret. Eight exact-paint/mutation cases pass (040752), rejecting quarter-pixel geometry and one-channel colour deltas. Numeric-rule/pin/architecture unit specs98/98 pass (040932).

Existing checks exposed6 expected-behaviour disagreements (040928): three desktop assertions still require focus in the input after a button press, two phone assertions depend on blur reformatting/moving the native selection, and Escape's selection check still needs investigation. The adopted gallery explicitly gives the button focus, preserves the shown precision while spinning, uses a separate marker and keeps touch carets collapsed; the first five assertions are being updated to those approved decisions with their numerical/carry/placement checks retained. No checks are skipped or deleted; Escape remains under investigation.

Native-selection investigation corrected: prototype interception proves no later script resets the selection. An actual click in the approved HTML also leaves the unfocused native selection[0,0] with the inverse marker on1. The app does the same. The four old desktop selection assertions now measure the visible logical marker's pre-text offset, one-character length and actual digit, retaining all numerical/carry checks. Escape is tested from the focused spinner. The attempted next-tick selection restoration did not change the browser's later collapse and was removed; it is not the solution.

Same-project closed-box captures now exist for prod v20261025T2233Z, test v20261026T2106Z and local dev c120b6b11+dirty, both skins. Personal review found a harmful calculated-colour change and a clipped sidebar frequency control. Both are recorded in BUG_20261027_rendition-branch-calculated-values-shown-entered.md; they block an all-beneficial claim. The base-form paint test omitted real calculated bindings. A real closed-box provenance test is now added before the colour fix.

Calculated-colour TDD: the real closed-box test fails blue-versus-green (041913), then passes after including the actual value-c provenance class in the calculated palette (041959). The generator clipping test fails against all three physical controls plus Hz at the quad-topleft ancestor (042112). The branch now keeps the complete, unchanged-size generator control visible by allowing a300px minimum expanded sidebar; its absent label/cue tracks take no space. This layout difference must be shown and justified in the next comparison. All16 numeric marker/focus/hold regressions pass (041940); no native-selection restoration workaround remains.

## Current checkpoint evidence and remaining scope

- [x] The closed-box calculated values MUST remain blue when their values are calculated. Evidence: red041913, green041959; real value-c provenance mapping repaired and personally reviewed in retaken phone/desktop images.
- [x] The frequency control MUST fit its clipping ancestors when the desktop sidebar is expanded at1280px or1024px. Evidence: red042112, both containment cases pass in042241; the full-size control is personally visible in the retaken desktop image.
- [x] The spinner MUST show the decided inverse marker and retain numeric precision when operated through buttons, arrow keys, holds and touch. Evidence:4 new interaction cases040847;16 combined marker/focus/carry/Escape cases041940, with native-selection behaviour compared directly to the reference HTML.
- open — The desktop pane MUST keep its natural stable height and contain its controls when tabs, box type, stored view preferences or window size change. Evidence still failing:3 original-shell-layout cases042241; BUG_20261027_rendition-branch-desktop-pane-layout.md remains open.
- open — Every field's complete control MUST stay inside its own row when wider spinners and external units/cues are drawn, including dual-chamber layouts. Evidence required: strengthen row containment beyond numeric-box-only checks, then run all page fixtures.
- open — Every text, choice, checkbox, error switch, date, readonly and disabled field MUST match its reference rendition when shown in either skin. Evidence required: actual state catalogue and full native-control inventory;44 numeric base forms alone do not prove this.
- open — Every numeric field MUST retain its declared validity and accepted-value behaviour when empty, refused, pasted, stepped through a limit, or switched between units. Evidence required: shared hook tests plus independent page integration; existing pure numeric rules98/98 are only part of this proof.
- open — Every actual page MUST use the canonical controls without test CSS injection when checked at the supported phone and desktop sizes. Evidence required: exhaustive page/field/state inventory, not a minimum measured-control count.
- open — Every old/new screenshot MUST have a justified difference and independent visual criticism when the branch is offered for approval. Evidence: only the closed-box page has current prod/test/branch captures; provisional gallery has6 per-image comments. Gemini Argon review has been requested read-only; its result must be inspected and findings resolved.

Personal comparison verdict: the compact phone control layout, outside model cues and restored calculated colours are beneficial for the stated reference. The desktop controls match the reference but its larger targets and wider sidebar consume chart space; the oversized empty bottom pane is harmful. Consequently no all-beneficial, app-ready, all-pages-complete or deployment claim is justified. Prod/test's zero semantic-row count in the new checker means those builds lack the new identity markers, not that their screens are clean. Their content/border measurements and actual pictures are retained.

Latest fast verification: full typecheck passes042553; pin/viewport/architecture units36/36 pass042905. Review-page probe initially timed out waiting for network idle because the comment thread polls continuously; direct image/comment readiness then proves6 images,6 figures,6 comment composers and zero page errors. The review template and publisher are now tracked so the artifact can be regenerated from the same capture records. DOM inspection narrows the oversized pane to the hidden Driver tab's323px column group; Advanced's horizontal content spans1149px. The geometry is still open, not waived.

Gemini review completed with exit0, confirms direct inspection of6/6 PNGs, and rejects readiness. Its full report is linked from the provisional gallery. All findings are retained in the desktop-pane bug record, distinguishing visually verified faults from approximate measurements and catalogue design criticism. The report specifically catches sibling link/diagram collision and an incorrectly anchored collapse toggle that individual-field checks missed. Work remains active; no all-beneficial attestation or completion claim. Current source checkpoint77f002302 protects the adopted hook and tests; follow-up review records are being saved separately.

Gemini's two concrete geometry findings now have red-to-green evidence: action/diagram and section-header checks fail on Alignment, and the collapse anchor is117px left of the sidebar boundary (043542). Chamber widths and the dynamic sidebar anchor repair both cases (043715). The numerical control appearance stays unchanged. A new deliberate200px-parent mutation proves the earlier checker missed spinner/model spill beyond a row (043829); full-control row containment is now being added before rerunning the page inventory.

Pane investigation: the Driver explanation shrinks into a very narrow strip beside the wider field group, making that group323px tall and forcing every hidden/visible pane to that depth. It is now moved below the group across the full pane, keeping labels unstacked and text unchanged. Advanced's parent gaps are reduced by10px total to address its9px short-window overflow without changing the rendition. The reload test also replaced the entire saved view, unintentionally resetting the sidebar width left by a preceding resize test; it now changes only the obsolete bottom-height preference while retaining every other stored UI setting. The original stable-height, under240px, and no-scroll assertions remain intact. Full shell regression is running.

Advanced inspection corrects the readout assumption: sound speed and density are calculated defaults but remain writable, so they legitimately have spinners. The attempted readout-only rail selector matches neither field and is not a valid explanation/fix. Actual measured tracks are386.609/371.062px and the overflowing group1155px. The remaining label widths/typography still come from the legacy14px skin rather than the13px Arial reference. A reference-label typography regression is added before correcting that mismatch; no control is being made readonly to gain space.

Latest checkpoint: reference typography failed14px versus13px then was repaired (045202 red; all14 reference/geometry cases pass in045354). Existing phone catalogue/page/editor checks pass20/20 after full-control bounds and label changes (045746); full typecheck045739 and lint045743 pass. Original shell now passes15/17 with PR height247 versus226 and Vented1112/1057 overflow still open (045354). Earlier reload mismatch was test setup resetting the sidebar width, fixed while preserving all assertions. The provisional gallery labels its images as the earlier snapshot and does not claim to show later geometry fixes. Remaining objective includes every actual raw field, nonnumeric rendition, state overlay, interaction and browser/viewport coverage, plus final same-project captures and Gemini criticism. No completion/deployment claim.

## Current steering: native caret after the final digit

- [x] The final displayed digit MUST gain the inverse marker and spin at its own place when the native caret moves after it. Evidence required: unit regressions and both gallery/app End-key regressions before/after the fix. This supersedes the older end-caret tenths fallback while retaining the default when no caret is chosen. The broader rendition goal and its two remaining shell failures stay open.

Caret fix evidence: shared unit rule red050158 and both UI marker cases red050202. One shared caret-to-digit helper now controls the app and gallery highlights as well as the stepping rule. Unit/field specs86/86 pass050555,37 unaffected targeted browser cases pass050552 and the updated Escape precondition passes050632; typecheck050356/lint050707 pass. Live published gallery verifies caret[8,8], last marker index7,123.4500→123.4501 and zero page errors. Existing tests that explicitly expected the superseded end-caret tenths fallback now require final-digit steps, retaining comma, carry, precision, focus and Escape assertions. The broad app rendition goal remains active and its known two shell failures are unchanged.

## Written field interaction design

- [x] The gallery MUST explain the field interaction thoroughly in words, equations and examples when John or the next agent needs the design reference. Evidence required: published14-section guide, readable phone/desktop equations and tables, comment composer, retained20 cases and unchanged end-caret example. The canonical guide is linked from FIELD_APPEARANCE_CATALOGUE.md and these handover notes; it distinguishes agreed behaviour from pending parity/coverage.

Written guide published and checked:14 sections,11 equation blocks, approximately3034 words. The real served page at374px and1280px has no guide/equation/table horizontal overflow, one guide comment composer, all20 original cases and5 cursor alternatives, and zero page errors. Existing decided-cursor and end-caret rendering regressions pass2/2 (051653). No interaction behavior was changed for this documentation request.

Handover entry point: http://lap:8000/winisd/openisd-t607/build/ui-contract/use-cases/?v=interaction-design-1#field-interaction-design . Source: docs/design/field-use-cases.html, details#field-interaction-design. It explicitly records inverse E chosen/A–D discarded; final-caret digit selection; step/place/rounding and hold equations; validity versus draft/model state; unit conversion; clearable/required/readonly/disabled/provenance semantics; mobile direct editing and1500ms ratchet; existing wheel/drag capability; independent DQ/model cues; worked cases; and actual verification gaps. Link to this canonical description from future handovers rather than silently inventing another rule set. The broad rendition goal, PR/Vented layout failures and remaining renderer/state/device audits remain open.

## Strategy and requested Argon review

- done — The field design review MUST expose missing risks and tests when Argon challenges the proposed implementation and verification strategy. Evidence required: strategy written before consultation, actual Argon response and recorded dispositions.
- done — The app review MUST identify concrete defects when Argon independently inspects the current branch against the written interaction design. Evidence required: exact reviewed checkpoint, source/line findings and reproducible regression suggestions.
- open — The reviewed fields MUST satisfy the agreed contract when verified review findings are repaired. Evidence required: targeted red→green checks and focused recheck, with unresolved decisions retained.

The detailed strategy is appended to FIELD_APPEARANCE_CATALOGUE.md under Execution strategy for the exclusive-rendition branch. It explicitly replaces a plan of accumulating page-specific CSS overrides with real shared components, independent scenario expectations, full control inventory, complete state coverage and holistic geometry/behaviour oracles. The full branch goal remains active.

Argon strategy review completed exit0. Full report: docs/design/reviews/T607-argon-strategy-review.txt. Dispositions and adopted refinements are in the catalogue; unsupported case approvals/counts and unmeasured visual claims are explicitly corrected. A separate fresh Argon current-work review is now running against10fbfcca3 source; no application source has changed during either audit.

Independent live detector probe completed:44/44 baseline rows no issues; removing two required spin buttons and model cue still passes; coordinated readonly attribute/native mutation also passes. Full finding and reproduction are recorded in BUG_20261026_ui-contract-coverage-gaps.md. No app source changed; these are confirmed detector false negatives, not inferred visual defects.

Confirmed Argon cursor-colour finding on actual Closed Box Fsc: input blue(0,102,255), selected marker inverse white at phase0 but entered-green(7,130,0) at normal phase0.7. Existing calculated-colour bug record reopened for the focused-cursor state with structured probe evidence. No glyph-fringe claim and no UI fix yet.

Additional confirmed interaction defect: a refused Qms0 draft retains its inverse marker after clicking outside the field (native focusfalse, marker1). Logged with source mechanism and exact successful probe; refused text must remain. Initial probe setup failures were first-run splash/storage notices and are recorded rather than counted as evidence. The false-negative detector probe was also verified again on the active unobscured catalogue.

TDD red established for refused-draft focus loss: new permanent regression in num-input-rendition.browser.spec.ts fails on the intended final assertion (expected0 markers, received1), while refused text, refusal message and actual blur all pass. Log build/test-logs/20261027-054412-3082670.log. This test was added after the10fbfcca3 source checkpoint submitted to the fresh code audit; application source remains unchanged.

Fresh Argon work audit completed exit0 against10fbfcca3. Complete raw report saved; C1–C7/H1–H2 each have a disposition in the strategy catalogue, including corrected counts, overclaimed border coverage, tentative event claims and unapproved Escape/default semantics. The refused-draft marker red test is repaired in a first pass (23 browser cases pass055100); common blur repeat cleanup is receiving an additional explicit held-key regression before the focused recheck. Same-project Closed Box production/test/branch-before captures completed,0 page errors, with marker0/0/1 after blur.


Focused repair verification: final24/24 browser cases green055426; refusal/pin13/13 unit cases
055731; full typecheck055452 and exact source/test lint055451 pass. First draft accidentally
removed accepted-blur timer cancellation together with the old trailing cleanup; the stronger
ones-place regression caught this introduced error before commit (055333). Final shared
cleanup cancels it before the refusal branch; the initial fractional case was too weak and
was strengthened, not credited as proof. Refused-draft marker red054412→green055426.

Four current immutable Closed Box pictures: build/ui-contract/closed-box-focus-v1/ . Prod,
live test and branch-after retain refused0 without highlight; branch-before retains the
wrong highlight. Personally inspected4/4; this specific correction is beneficial and agrees
with production. Other existing rendition/style differences remain proposed/unresolved.
Published page has4 images,4 comment composers,0 errors and no overflow at374/1280; SHA
wrapping fixed its initial phone overflow. Argon is performing the focused source/image
recheck; broader C1–C7 findings and two shell failures remain open.


Argon focused recheck completed exit0, inspected4/4 PNGs and4/4 records, accepts the narrow
blur cleanup and verifies its visual benefit. Its material reporting findings are fixed:
caption now explicitly names hidden Qtc0/overlapped Fsc on live test; corrected manifest
separates recorder head, remote build version and hook-only patch hash; branch captions show
before/after hashes and do not pretend these identify remote deployed source commits. Raw
records/pictures are preserved. Additional refused-floor hold regression is running to close
its low-severity coverage gap. This recheck does not approve the whole branch or other cases.


Final outcome for the requested strategy/Argon consultation: strategy written before review;
Argon strategy pass, independent current-code pass and focused source/image recheck all
completed exit0. Each material finding has a disposition; the broad goal remains active.
The additional refused-floor repeat case passes060127. Total targeted browser evidence is
24 cases055426 plus that1 new case;13 refusal/pin units055731, final full typecheck060227
and final changed-test/publisher lint060224 pass. Hook lint passed055451. The corrected
published page still has4 loaded images,4 comment composers,0 page errors and no overflow
at374/1280. All owned work is being committed with hooks enabled.

Next concrete slice: independent Closed Box scenario manifest declaring Vb/Fsc/Qtc,
contextual access, expected editors/units/spinner/model/DQ parts and healthy/refused states.
Prove removal of a row, spinner or cue and coordinated fake readonly access are detected,
then apply the same general detector to each other declared host. Whole-control and raw-
control reconciliation must precede claiming full coverage. Cursor normal-phase provenance,
unit-change state, registry unit affordance and remaining families/panes stay open. No new
use-case approval, merge, release, deployment or full-conformance claim was made.


## Independent field inventory implementation

- done — The Closed Box page MUST report a missing spinner, model cue or wrong readonly binding when an independently declared scenario is checked. Evidence required: existing-checker false negatives as red browser cases, replacement inventory checker and named green mutation failures on phone/desktop.
- open — The other pages MUST account for every native value control when the same inventory detector is applied to their declared scenarios. Evidence required: source-authored manifests, no missing/unknown/duplicate/unmeasured controls and generalized mutation checks.

Previous goal turn classified as progress: strategy/reviews saved, three independently reproduced detector/interaction findings, blur repair,25 targeted browser and13 unit checks, four current images and Argon criticism, committed4ccd49f9a. This continuation starts from the clean branch at that checkpoint. No image scanning or appearance changes are involved in the inventory implementation.

TDD red061328 proves all three intended old-checker false negatives: missing spinners, missing model cue and coordinated readonly mutations produce no issues. The replacement inventory now consumes a separate source-authored scenario, audits raw controls as well as registered rows, and never derives expected access/part presence from the DOM. Existing compact geometry checks remain separate and do not gain a false independent-semantics claim.

Independent Closed Box baseline and11 mutations pass on both skins (24/24,061838). The first replacement run correctly exposed a scenario mistake: Qtc empty unit placeholder is intentionally hidden by the explicit :empty CSS rule, now declared as hidden/noninteractive rather than silently skipped. Additional red062242 proves unknown inner buttons and disabled spinners escaped the first inventory draft, and the old catalogue checker measures44 of96 forms. Full-family declarations and interactive-part reconciliation are being added before application across other hosts.

Generalized inventory transferred to full real Driver and Signal pages (7 and3 value controls), with whole unit-removal mutations detected; primary numeric paint gate also reconciles all96 forms. Allpass initially declared no model cue, but OriginalFiltersAPI explicitly documents its model-level cue regardless of order, agreeing with John; its expectation is corrected to1, not suppressed or inferred from current digits. Existing source gallery uses flex rows and108px number boxes throughout; Argon earlier claims about a156px unitless reference or fixed-grid reference were inaccurate and are not implementation authority.


Full relevant regression064757:69/69 browser cases pass (Closed Box two-skin mutation suite,
real Driver/Signal/Allpass inventories, all96 catalogue forms, existing page geometry and
reference paint checks). Source discovery now covers92 templates/152 value-or-action-input
and semantic-role declarations and preserves the dynamic element; counts/classification and
limits are in the catalogue/coverage bug record. No application rendering code changed in
this slice. Broader host/state inventories, source reconciliation, actual shared-renderer
migration and complete paint/behaviour matrix remain open.


Argon inventory review completed exit0. Its concrete holes were reproduced with12 red cases
072211 (group ownership, labels/options, inaccessible/ghost controls, decoy spinners, cue
native type, checkbox state), plus4 renderer/DQ red cases072757. The checker now owns complete
select rows, records option effective labels/disabled state and checkbox state, checks required
labels and native/button signatures, catches inert/ARIA/tab suppression and layout ghosts,
reconciles loose parts/readouts, and pins current96-form cardinality. Full relevant browser
run073006 passes96/96, including all original and new negative cases. No app renderer source
changed in this slice. Independent approved paint/behaviour verification is still incomplete.

Source discovery now retains154 value/action/semantic/readout declarations,265 value-component
uses,1 dynamic element,1 dynamic semantics binding and5 opaque spreads across92 templates.
Original152-declaration report is preserved in source-inventory-snapshots/initial-152.json.
Current snapshots carry template/generator fingerprints and parser version; latest JSON links
the immutable snapshot. Classification is path-specific and still discovery, not an allowlist
or runtime conformance proof. Unit/type/lint and focused review recheck are being completed.

Independent family-cardinality unit checks pass3/3 (073928); full typecheck073921 passes. Final lint caught a generic element.className assignment in one mutation callback; replaced with typed getAttribute/setAttribute while preserving the exact mutation, with focused negative-case verification to follow. Inventory tests assert editor/access/parts, not full domain-cell write identity; naming is clarified and functional binding tests remain required.


Argon recheck materially closes all five major inventory findings. The two remaining
ordinary-Boolean marker mutations fail080822 and pass081159 after symmetric native-editor
selectors were added; the7-case run includes all96 catalogue forms and all six renderer
mutations. Independent family-cardinality unit run081224 passes3/3. The existing full targeted
browser run073006 passes96/96; the final2 new negative cases are additional focused proof.
Spinner Tab accessibility remains open for the next component migration: the app already
has tabindex=-1 and the review's suggested -1 mutation was a no-op. No app renderer changed.

- done — The numeric spinner buttons MUST receive keyboard focus in the agreed order when the user presses Tab, retaining digit selection while focus stays in the field group. Evidence required next: reference-versus-app native keyboard red case, shared-component repair and focused interaction/screenshot review.
- open — The readonly Driver figures MUST use the approved numeric appearance when the Driver page opens. Evidence required: strengthen the independent scenario beyond the current legacy spans, observe red, migrate and compare the same project against production.

The independent Closed Box inventory step is verified by50 phone/desktop browser cases
(baselines plus24 mutations per skin, part of073006). Driver/Signal/Allpass declarations
and mutations cover their bounded phone surfaces; the broader other-pages item remains open.
Final documentation and Argon consultation are being preserved before the next renderer step.


Final typecheck081221 passes all three packages; final changed-file lint081224 passes.
The source report's trackedApplicationDiffSha256 scope includes the entire design package,
including its changed test: the nonempty fingerprint must not be described as an app source
change or as empty. Catalogue evidence prose is corrected accordingly.


Final Argon consultation completed exit0, saved in T607-argon-inventory-final.txt. It
confirms symmetric Boolean/BugToggle closure. All residuals are retained in the catalogue
ledger: spinner attributes/Tab, live DQ states, text-vs-numeric wrappers, Allpass checkbox
distinction, Driver readonly migration and complete nonnumeric/host checks. Its underline
claim overlooks field-catalogue.css:83's active inverse override; the actual colour-phase
bug is already tracked. No app/source visual approval is inferred from the review.
Requested strategy consultation and current inventory review are complete; broader goal
remains active. All owned changes will be committed with hooks enabled; no landing attempted.


## Native keyboard group migration

Previous goal turn was progress: committed9cd6b84f7 with independent inventories, deliberate
mutation proof, verified Argon consultation and all final gates. Current slice changes actual
shared controls, preserving the full exclusive-renderer goal.

Native-Tab red081939 proves skipped spinners and lost draft zeros across three unit families.
The shared unit slot, natural DOM order and group-boundary cleanup pass082250. An initial
post-fix draft exceeded two real intrinsic limits; use valid1.2500 across the variants, without
weakening limits or assertions. Two further inventory mutations red082318 now enforce native
spinner type and ordinary Tab access in both generic/catalogue maps. Actual Closed Box native
keyboard sequences pass on both skins in082356.

Eight-spec browser run082356:135/136 pass. The sole legacy marker-clearing assertion is
strengthened to John's later end-caret rule (focus+exact final-digit marker+actual10.01 spin),
and passes082625. All136 unique relevant cases now have passing evidence. Domain and
shared-unit/readout architecture checks082411 pass57/57; initial typecheck082329 and lint
082414 pass; final gates and Argon visual/code review are in progress. No full-suite,
whole-app-conformance or deployment claim.

Four same-project Closed Box images were captured before/after and against live prod/test,
personally inspected and published at build/ui-contract/closed-box-native-tab-v1. The new
Tab target/retained inverse digit are beneficial; all three108px boxes agree with reference. The
initial narrowing impression was disproved by identical Vb/Fsc PNG regions and corrected.
All pre-existing proposed appearance changes remain labelled, not approved by the repair.
A separate review-page-check.json proves4 loaded images,4 individual comment boxes,0 errors,
no374/1280 overflow, and108px live number widths. Argon has the exact diff, the old-test
assertion change and exactly those4 images for independent criticism.


Argon's4-image/code review found a real key-hold transfer bug, reproduced083505 and
strengthened to both cases083612 before repair. Internal blur now always stops repeat.
Unit-change stale marker reproduced083847 after correcting the expected physically
converted precision to0.2000000; the watcher clears old place/caret/marker and resets native
selection. Stronger backward tests then exposed whole-value native reverse-Tab selection
(88/89 at084004); after-focus restoration passes all6 focused cases084253. Final affected
five-spec regression084350 is93/93 green, including both skin hosts and both sheet modes.
Outside-click clearing is explicitly restored after the end-caret assertion, not removed.
Final typecheck084538 and full changed-source/tests lint084349 pass.

Initial image narrowing prose and Argon's8–10px shift assertion were false. Original Vb/Fsc
PNG regions are byte-identical; complete difference is only Qtc focus/marker bounds. The
publisher/docs are corrected; this is review attribution evidence, not bitmap test reliance.
A final fresh source capture is published; the original page/images/records remain archived.
The independent focused Argon recheck is running against current code and exactly4 images.
Remaining latent entryValue output contract, inverse-colour/mandatory-marker paint, legacy
style removal, readonly/native migration and full conformance work stay explicitly open.


Focused Argon recheck opened4/4 current images, confirmed five closure groups and corrected
its earlier shift claim. Its final null-marker reverse-Tab edge is reproduced085015, then
repaired by end-digit fallback with exact native selection and real spin assertions. Final
five-spec regression085059 passes94/94. Final typecheck085202 and caret/publisher lint085158
pass;57 targeted units/architecture084709 pass. All earlier screenshots are preserved; final
source capture is branch-after-final-caret and is pixel-identical for the photographed state.
Argon final edge recheck is pending. Broader provenance, unused event baseline, canonical
style ownership, readonly migration and complete app/form/state coverage remain open.


Final Argon caret recheck confirms scoped closure, saved in
reviews/T607-argon-keyboard-caret-recheck.txt. All4 inspected-picture findings have source
or measured-attribution dispositions; current after image is pixel-identical for the same
forward-Tab state. Final source capture metadata identifies the exact tracked UI patch.
Final publisher lint085420 passes. No owned test/review/capture jobs remain running.

- done — The numeric field MUST keep the ordinary caret placement when the user clicks a decimal mark or sign while returning from its unit or spinners. Evidence required next: pointer re-entry TDD, including Android collapsed caret, exact marker and subsequent spin. Argon's non-blocking observation is tracked, not declared repaired.
- done — The calculated number MUST keep its calculated colour during the ordinary cursor-blink phase when a digit is selected. Evidence required: real Closed Box calculated-field off-phase red, shared paint repair and same-project review.

The native-keyboard item is complete with red081939/083612/083847/085015, full final
94 browser cases085059,57 units/architecture084709, typecheck085202, full changed-files
lint084349 plus final focused lint085158/085420, four-image reviews and final focused
Argon closure. Spinner-first entryValue/unused blur-notify remains a separate latent
contract item. Complete app conformance and canonical renderer/style adoption remain open.
All owned work is being committed with hooks enabled; no landing or deployment attempted.


## Pointer, cursor ink and native readonly migration

Previous goal turn was progress, committed e1f9e2887: actual keyboard group migration,
94 final affected browser cases,57 domain/architecture checks, personally inspected
production/test/before/after images and three Argon keyboard reports. Full goal stays active.

Pointer red090025 reproduces the mouse decimal re-entry bug (touch already passed).
The hook now distinguishes a pointer focus from reverse Tab restoration. Cursor/readonly
red090141 reproduces two-skin calculated-ink corruption, five legacy Driver spans and
pointer unit activation opening the unrelated Editor. Keyboard unit bubbling separately
fails090418. Shared NumReadout now has one native readonly input rendition; its span/asInput
alternative is removed. UIFieldBody no longer asks for the plain alternative; Driver's
independent manifest requires native readonly inputs. Unit activation stops bubbling only
when it actually switches a unit, preserving plain-label behaviour. Eight focused cases
pass090658. Values and readonly palette remain unchanged; origin colour remains a broader
separate issue, not inferred as correct just because a field is readonly.

- in_progress — The readonly Driver figures MUST use the approved numeric input form when the page opens, retaining values and preventing edits while units remain usable. Evidence required: native form/label/no-edit tests, whole catalogue and host border/fit checks, same-project screenshots and Argon criticism.

The new ordinary-cursor detector runs across35 contexts/cases091342: main pages, all box
models in both skins, both editors' four tabs, Allpass, Advanced and both sheets; missing
numeric fields are not proven by that cursor-only enumeration, so full source/host inventories
remain required. The explicit calculated Closed Box cases use the same detector with an
independent blue-colour expectation. Further detector TDD091954 proves a999ms cycle and a
finite blink count escaped the first version; timing and infinite-iteration checks are added.
Per-case numeric/empty counts are attached to browser results for honest coverage reporting.

Eight same-project capture records are preserved in closed-box-pointer-ink-v1 and
driver-native-readonly-v1. Project bytes are frozen before after-capture. Both four-image
sets were personally inspected, Closed Box first then Driver. Driver before/after screenshots
are pixel-identical despite the native semantic repair; Closed Box exposes correct blue ink
and a collapsed caret instead of the old final-digit selection. Glyph-edge raster differences
outside the selected digit are included in image review; do not invent a layout-movement
claim from the wide pixel difference bounds. Publication/Argon review and broad gates follow.


## Selective visual rollback authorised 27 October

The full compact-design adoption remains paused. John selected production-style joined
value/unit boxes, with ⚠ outside left and ≠W outside right after the spinners/dropdown.
Independent domain, input, focus, counts, seed and unit-navigation fixes must be preserved.

- in_progress — The numeric fields MUST show a joined value and unit box when any app page opens, retaining external warnings and model cues. Evidence: new joined-field browser contract, meaningful red then green.
- pending — The Driver page MUST retain the production readonly appearance when the same project is compared before and after. Evidence: same-project production/before/after pictures and personal review.
- pending — The editable fields MUST retain digit, keyboard, repeat and validation behaviour when their appearance is restored. Evidence: affected behavioural and domain tests.
- pending — The preview MUST show the restored fields when opened on the phone, without loading development modules. Evidence: new full bundle, persistent-profile check and public preview capture.
- pending — The comparison page MUST let John comment under every picture when reviewing the restored controls. Evidence: published comparison with per-picture composers and Argon criticism.


## Selective restoration verification, 27 October

The selected production-style joined preview is now running on4607. Final captured
Closed Box boxes160px share their edges and use16px number insets; readonly Driver boxes
are170px grey joined boxes in production blue. Outside cues retain their requested sides.
Personal production/test/before/final comparison is published at
http://lap:8000/winisd/openisd-t607/build/ui-contract/joined-boxes-v1/ with a composer
under each of eight images. Header/cloud differences are explicitly environment-related.

- done — The numeric fields MUST show joined value/unit boxes when the app opens. Evidence: initial red105956, final joined/inventory20 cases112858; same-project final pictures personally inspected.
- done — The Box rows MUST share value and spinner edges when some quantities have a model cue. Evidence: screenshot finding, red111301, green111510 and112858.
- done — The field outline MUST retain its colour and thickness when a unit covers its right segment. Evidence: strengthened paint detector red111419, green111510, broad195 passing cases111714.
- done — The inverse marker MUST cover the selected digit when input border and focus styles differ. Evidence: geometry detector red111419, generalised run111714, sheet red112022 then green112105.
- done — The PR fields MUST retain their displayed precision when warnings and model cues coexist at narrow phone widths. Evidence: real360px glyph collisions111714, focused360/374 green112022.
- done — The keyboard MUST visit warning, number, unit, spinners and model cue in their visual order. Evidence: red111911, green112022 and112858.
- done — The functional controls MUST retain their behaviour after the appearance rollback. Evidence:158 domain checks110356;135 browser passes110924 plus corrected native readout width locator111141; final20 joined/inventory cases112858.
- done — The preview MUST retain the saved project when its bundle is replaced. Evidence: final-joined persistent profile record,15requests, no development imports/errors, unchanged saved project.
- done — The comparison page MUST expose independently criticised pictures when John reviews the restoration. Evidence: eight loaded pictures and eight working composers; original Gemini image/source review plus follow-up personally verify the reviewed pictures and find no concrete blockers in the selected restoration.
- pending, BLOCKS LANDING — The visual regression checks MUST enforce the selected appearance when the rejected compact prototype is retired. Evidence: four incompatible exact-paint assertions remain red112705 and are recorded in BUG_20261027_joined_field_restore_gaps.md. No tests skipped/deleted/weakened. Canonical use cases still need John's approval; wholesale adoption remains paused.

The earlier historical progress text saying the full goal is active describes earlier
turns; that goal was explicitly paused by John and is not resumed by this selective repair.


Final review closure: Gemini found the Inter→Arial readonly change, long-word warning-label
collision and doubled stepperless cue gap. They were reproduced and repaired; actual
production-font measurements,113350/113526 reds,113601/113832 greens and114406 mandatory
outline checks are recorded in the bug file. The final label detector was applied to the
other page fixtures:143 pass and three desktop tuning-label descender failures in113433,
all three then green113832. The paused canonical paint migration remains BLOCKING landing;
this is a preserved reviewable preview, not a claim that the whole suite is green.

The reviewed preview uses the full bundle at build/joined-preview-reviewed, served build
v20261027T1138Z, with15startup requests. Saved-profile restore1059ms; cold simulated phone
9576ms on200ms latency and50KB/sec; no errors or development imports. Both phone comparisons
were personally inspected again after restoring Inter. Gemini follow-up agrees the field
changes are beneficial and found no remaining blockers within the inspected restoration.
Remaining suggestions outside this slice are tracked, not silently treated as resolved.

Final checks after the mandatory-outline cases: strict changed-files lint114529 and
typecheck114532 pass. The served source patch matches the reviewed capture byte-for-byte
(6d0c094fb18fabf66059f8dd7f02e427ba218133038c9434baacbb66f83c60de).
All owned work, including the earlier pointer/native-readonly repairs, is preserved in
one commit with hooks enabled. No landing or deployment is attempted; four old draft-paint
assertions remain explicit release blockers. Only the requested bundled preview remains
running after handover.


## Local Box losses textbox correction

John reported Interchamber Qicl disappearing under its value, asked for narrower text
boxes without wrapped labels, and then explicitly cancelled the broader audit with
“forget my comments about broard context”. Only the local popup correction continues.

- done — The Box losses popup MUST show full single-line labels beside narrower text boxes when opened. Evidence: red114955,55 layout/behaviour checks115046,28 unit/hook checks115914, typecheck115909 and lint115915.
- done — The comparison MUST show the corrected popup first when John opens the picture page. Evidence: published after/before/production comparison with a text composer for each image. Gemini confirms no wrapping or unintended change; font, right edges and spinners stay fixed.
- cancelled by John — The broader app audit MUST visit every screen, tab and popup for each box type. John cancelled this scope explicitly; no exhaustive audit was performed or claimed.

Preview: http://lap:4607/ full bundle build/surface-audit-preview-v1. Comparison:
http://lap:8000/winisd/openisd-t607/build/ui-contract/surface-audit-v1/qicl/.
The previously shown wrapped picture was BEFORE; CORRECTED is first on the updated page.


## Driver Info button enhancement

- done — The Driver page MUST show Info between Select driver and Edit on both skins when a project is open. TDD: missing button red120608, action red120612; implementation plus four phone/desktop widths green123514. DOM assertions cover order, one row, equal heights, no overlap and minimum target height.
- done — Info MUST show the current embedded driver's existing specs and provenance without replacing it or opening an editor. Shared action unit preserves UUID, values and clean saved state, and skips catalogue fetch. Browser checks the expected name/Fs and aligned summary with no Use/Clone/Edit actions.
- done — Every Info close path MUST restore normal picker/editor behavior. Close, header X and Escape are exercised; Select driver must display actual catalogue rows, then Edit opens the normal editor. Gemini found a direct-close state risk; red123234 reproduced it and the synchronous logic cleanup passed unit/import123303. Final unit also requires immediate cleanup.
- done — The requested phone preview MUST show the enhancement. Full production-mode bundle build/driver-info-preview-v3 serves http://lap:4607/. Persistent-profile startup restored the saved project in1169ms,15requests,no errors or dev imports. Source patch matches the final captures.
- done — The comparison MUST use the same project on production, previous preview and current preview. Eight published images have individual comment composers; gallery smoke reports8figures/8images/8composers,no overflow/errors. The first production phone stable capture accidentally showed Box; it is excluded and corrected Driver captures are published. Final phone Driver/Info and desktop Info images are byte-identical to the Gemini-reviewed captures. Desktop Driver was personally inspected again.

Comparison: http://lap:8000/winisd/openisd-t607/build/ui-contract/driver-info-v1/.
Gemini source/image first review and recheck are preserved in docs/design/reviews/T607-argon-driver-info-review.txt. Recheck found no correctness blockers. The new action is beneficial: immediate access to current driver information with the same summary renderer; no row-height increase or value changes. Phone outer buttons narrow symmetrically to fit44px Info; desktop Edit moves right. Existing cloud/banner configuration and joined-field/hint differences versus production predate Info and are disclosed in the gallery.

Checks: four Info browser cases123514; unit/import4cases123303; final strict source/test lint123413; typecheck123317. Final immediate-reset unit2cases123558, strict test/script lint123605 and typecheck123602 pass. Existing Driver-tab9cases and wizard/library7cases passed earlier in this enhancement.
Full npm build prebuild lint123319 remains blocked by existing generated packages/ui/build assets and earlier joined-field test lint issues, plus the then-untyped geometry test (subsequently fixed). Changed-file lint passes; direct production Vite build123426 passes with the complete catalogue. No blanket lint/suite green is claimed. Four earlier draft-paint assertion blockers remain recorded above. No landing or release was attempted. Broad audit remains cancelled.


## Automatic typography enforcement

- done — The shared DOM check MUST catch the production readonly font changing on any phone numeric readout, including the last one. Independent Inter family/15px/400/normal/22.5px/normal-spacing expectations; six controlled substitutions red123938 then green124127.
- done — The DOM check MUST catch silent fallback when CSS still names Inter but its font faces are absent. Explicit loaded regular Latin face plus FontFaceSet.check; removing font declarations flags all five readouts. No bitmap or AI judgement is involved; existing automatic network-error guards remain intact.
- done — The existing shared page fixtures MUST remain usable with the stronger contract. All65 selected existing page/box-type cases pass124214; seven mutation/fallback cases pass124127, typecheck124131 and strict lint124134 pass. Readout ownership architecture check124339 also passes.

The actual app appearance is unchanged. The prior broad audit remains cancelled and old draft-paint landing blockers remain recorded. The test strategy now records typography as a deterministic contract with explicitly bounded reference roles.


## Three-page field consistency and spinner swipe repair

- done — A vertical swipe starting on either spinner MUST leave values unchanged and allow native scrolling. Four real-touch direction/button failures124717; shared gesture confirmation then eight tap/hold/swipe passes124954, plus actual multi-card scrolling and cancellation/no-late-repeat2passes125116. Existing domain/stepper-pinning87passes125528.
- done — Driver, Signal and Filters numeric boxes MUST share one narrow responsive width when the same phone viewport is used. Three width regressions red125251; three widths plus14joined checks green125413. At374px Driver/Signal170→134px; Filters134px preserved. Short Driver dropdowns match. Numeric glyphs, labels and borders remain checked. The optional wider-versus-narrower question is unanswered; narrower follows the user's prior preference and is a stated assumption, not a new canonical use-case approval.
- done — Existing mouse, keyboard, digit, readonly and focus behavior MUST remain covered. Broader spinner26passes125417 with one old readonly-span expectation corrected to verify native readonly/no-spinners/typing protection (green125737); desktop4pass125848 after input-blur cancellation preserved. Phone keyboard pinning green130050; final typecheck130053 and strict changed-file lint130058 pass. Final full bundle125746 and capture source hash d07e8c316773f93e85354185851bdef2cd089b4858db132e5c0963eaaf6b8463 match.
- done — The phone preview MUST start with saved projects intact after replacement. Full build/field-consistency-preview-v2 served on4607; saved-profile startup1301ms,15requests,no errors or dev imports.
- done — Comparison and independent criticism MUST cover only the requested three pages. Nine same-project production/before/current images published with individual comments; personally inspected. Phone gallery smoke:9pictures/9loaded/9composers,no horizontal overflow or errors. Filters card indentation remains; prior cloud/banner/Info/joined-box differences disclosed. Gemini first review and final recheck are preserved; final recheck found no blockers after concrete criticisms were reproduced and fixed. Broad audit remains cancelled; no deployment or all-suite green claimed.

Comparison: http://lap:8000/winisd/openisd-t607/build/ui-contract/field-consistency-v1/.
Targeted runners now use the repo's built-in resource limits without the obsolete outer heavy lane wrapper.


Final refinements after independent criticism: hold double-delay red130655 and in-button
thumb-drift cancellation red130809 fixed; actual touch timestamp controls cadence and
acceleration. Focused draft swipes preserve text and focus. Touch/pinning15pass130914.
Equal widths alone left a13px column offset: edge regression red131054, then unframed
Driver/Signal label columns gain13px so input/unit edges match Filters. All17final
width/touch cases pass131158; strict source/test lint131204 and typecheck131319 pass.
The final preview is build/field-consistency-preview-v4 (replacing earlier V2 evidence),
full build131201. Final saved-profile restore1421ms,15requests,no errors/dev imports.
The gallery now shows after-final images;9pictures/9loaded/9composers, no overflow/errors.
Gemini final recheck found no visual or correctness blockers. The false Series/parallel option claim was retracted. Final54caret unit cases pass131531; comparison scripts lint131418. Final capture matches source patch dc29af007f2889971efeb05cdd062e6e39dbc63cbe70cbd1421f67a7d07b78cb. No other pages or use cases adopted.


## Mobile appearance correction after narrowing rejected

- done — The Driver page MUST return to its fuller boxes when John rejects the narrowed experiment. Red135654, restored-width green135923. The page-specific narrow cap/extra label offset are removed, while the spinner swipe/hold fixes remain. The previous all-equal narrow-width contract is explicitly superseded by John's ruling in the field catalogue.
- done — Mobile single-row fields MUST align their inner text consistently when used as numbers or short dropdowns. The previous dropdown14px versus numeric16px mismatch is red140957; shared label presets now provide16px, and18main-tab/joined/pinning cases pass141239. Sheet inputs and cursor overlays use the same inset;2sheet cursor cases pass141243.
- done — The common spacing definition MUST reserve fixed cue dimensions when a cue is absent. Design tokens define26px DQ and24px model rails; token red141203 then10design/pinning checks green141235. Tokens do not by themselves prove the permanent rails render everywhere.
- in_progress — All mobile single-row controls MUST retain their horizontal positions when either cue appears or disappears. Source inventory mapped the mobile form/tab/editor/sheet/popup families. Left-rail placement preference remains unanswered; permanent rail layout is pending that choice. Do not claim all mobile controls audited or conformed.
- pending — The mobile tabs and popups MUST use the shared field appearance when each is opened. Numeric popup matrix found Tune/What-if using a different editable font from tab fields (red141810); common numeric font fix passes the six reachable popup profile cases plus two sheet-cursor cases in141919; the Box losses setup label was corrected and its case passes142212. No error was suppressed. Source mapping is not complete runtime coverage; native/search/compound contexts remain to reconcile.

The fuller restoration preview initially serves build/mobile-spacing-restored-v1. Its saved
project restore is1192ms,15requests,no errors/dev imports. The updated shared-inset/font
bundle and comparison will be recorded before this checkpoint is handed back. No release,
landing, desktop change, completed global cue-rail migration or catalogue approval claimed.


Restoration checkpoint: build/mobile-spacing-restored-v3 is served on4607. Final saved
profile restore1213ms,15requests,no errors/dev imports. Driver restoration/three-tab
shape checks18pass141239; popup profile7cases and sheet cursor2cases pass across141919
and142212 after TDD font mismatch red141810. Design/pinning10pass141235. Typecheck142153,
strict source/test lint142156 and publisher lint142447 pass. Full build142200 passes.
Comparison: http://lap:8000/winisd/openisd-t607/build/ui-contract/mobile-row-spacing-v1/.
Three pictures load with3comment composers and no overflow/errors; old experiment page
is explicitly marked rejected. Current Driver personally compared to rejected/prod frames.

The permanent left/right cue rails remain pending application across all mobile hosts.
Only their dimensions and the common inset are defined so far. The left-slot placement
question is still unanswered; no global layout or complete audit is claimed. The broader
canonical catalogue approval remains outstanding. The all-mobile spacing objective must
continue after that preference is supplied; this commit is a preserved restoration checkpoint.


## Complete mobile inspection manifest requested by John

- done — The inspection page MUST list minor popups, nested conditional content, help, field descriptions and documentation when opened. Shared declared list plus generated source/docs inventory published at http://lap:8000/winisd/openisd-t607/build/ui-manifest/mobile/; 155 declared variants,260 help/field-doc entries,942 docs/assets,595 source roots/branches and24 template links. Source branches are not independent pages; shared-source applicability remains explicit.
- done — The inspection page MUST reveal missing automated visits when a listed surface has no navigation test. Manual/navigation-gap rows remain visible. Native browser/OS surfaces and data-dependent families are declared without fabricated DOM proof. Appearance/use-case approval remains John's.
- done — The mobile tabs and registered popups MUST open when automated navigation follows the same inspection list.48core visits pass144304 in51.6s browser/61s total;10new filter-card visits pass145557 in15.7s/25s total.58passing visits now retained across reports; these assert visible roots/mobile skin, not full appearance or functional conformance.
- done — The inventory MUST flag newly added popup branches, documentation and links when they have not been reconciled. Empty-index and invalid section-help owner red145230; corrected owner and known inventory index green145547 (4tests). Anonymous/nested popups are included. Fast unit process1.29s; source scanner assertions about430ms. This gate preserves known discovered structure; it does not prove arbitrary dynamic UI completeness.
- done — The published inspection page MUST remain usable on a phone when searching the complete inventory. Phone374px smoke145857 verifies1976rows,58passing visits,package/bug docs,search/category filtering,working comment composer,no horizontal overflow or page errors. Full typecheck145725 and final UI typecheck145933 pass; strict manifest lint145930 passes. Permanent cue rails and left-slot placement remain separately pending as recorded above.

Repository-wide documentation correction: package README and bug files were outside the first
scanner's docs/root boundary. New package-guide fixture failed145811; repo-wide ignored-file-aware
listing plus docs assets now includes942documents. Four inventory checks pass145841 (1.80s unit
process/about680ms assertions). No runtime/UI conformance claim is inferred from this count.


## Logical flow for the inspection page

- done — The inspection page MUST follow creating a project, selecting a driver, designing a box, shaping the signal and viewing results when John opens the manifest. Ordering/retention tests red152757,6unit checks green152848. All155declared surfaces appear once in eight ordered chapters; new unplaced entries fail. Minor popups sit with their owning task.
- done — The documentation and source inventory MUST remain discoverable when the page is organised around the app journey. Four expandable reference appendices retain help,942docs/assets,595source roots and24links. Phone smoke153107 confirms all1976rows retained,search opens nested documentation,clearing search restores previous open state,and58passing visits/97navigation gaps remain.
- done — The inspection page MUST work on a phone when its grouped sections are searched or opened. Phone374px smoke153107 verifies chapter ordering,ABC chamber-loss nesting,category filtering,expand/collapse,comments,no horizontal overflow or errors. UI typecheck153110 and strict lint153114 pass. Current phone rendering personally inspected. This changes the manifest presentation only; app appearance and use-case approval remain unchanged.


## Illustrated catalogue and useful view identities

- in_progress — The visual catalogue MUST show actual screenshots when John inspects each app view. Prepare a separate draft while he reads the existing page; capture production and current preview from the same frozen project and phone viewport. Uncaptured views must remain explicit gaps.
- pending — The view names MUST describe the task, parent screen and variant when shown to a reader. Introduce stable hierarchical identities while retaining original IDs as aliases for existing evidence and comments; verify uniqueness and completeness.
- pending — Each screenshot MUST accept a comment when opened in the visual draft. Show build/project/viewport provenance and keep source links secondary. Verify every published image and comment composer and preserve all documentation/reference entries.


## Reported inside cue and misleading production-reference presentation

- done — The reported wizard image MUST be traceable when John questions its source. It matches the production capture v20261025T2233Z at16:53:14Z; current preview capture v20261027T1419Z has the cue outside. Fresh check of actual lap:4607 at17:18:54Z confirms control right258/cue left260,outside=true,no page errors. Original captures remain preserved.
- done — The document MUST show the preview by default and keep the source/build visible when an image is scrolled. Default-order red172037; preview-only/source selector and sticky captions green172205. Capture-time URLs avoid stale images after recapture; final sticky-label check pending. Source controls are separated from platform controls.
- done — The real wizard MUST fail the DOM contract when its model cue is placed inside the control even without touching digits. Old helper accepted the mutation (red172040). New value/unit/spinner-boundary rule plus actual-wizard baseline2pass172201. No app-layout source changed for this field.
- done — The existing mobile/desktop field pages MUST satisfy the same outside-cue rule when opened.73targeted existing overlap/editor/enclosure cases pass172348 (68s browser); actual-wizard baseline and mutation2pass172201. Final UI typecheck172523 and strict test lint172520 pass; earlier all-changed-file lint172420 had only the two subsequently corrected setup-condition warnings. Nine inventory/identity/relationship unit checks pass172354. No all-view or full-suite approval inferred.
- pending — The visual catalogue MUST distinguish recorded screenshots from approved conformance when reviewed. Current draft has independent mobile/desktop identities and preserved gaps; production startup-reload frames were quarantined and retaken with normal worker startup plus post-frame DOM validation. Gemini review unavailable: installed client/account returned UNSUPPORTED_CLIENT. No all-view approval or full-scrolling audit claimed.


The illustrated draft now has274declared views/states/action entries:157mobile and117desktop.
504images are present, each with its own comment area:138mobile-preview,137mobile-production,
113desktop-preview,116desktop-production. These counts are screenshots, not conformance passes.
Uncaptured guarded/OS states and independent-platform gaps remain explicit. Initial viewport
coverage remains bounded. Further broad captures were paused on John's reported mismatch; only
the exact wizard verification was run afterward. The original source-heavy document is unchanged.

The gallery default-order test failed172037 and passes after correction; sticky source/build
caption, source controls, image decoding,comments,platform filtering,reference search and both
viewport widths pass172256. Shared detector mutation failed172040 for the precise missing rule,
then passed172201 after the geometry assertion was added. Work is preserved as a checkpoint;
permanent field cue-rail migration and canonical use-case approval remain pending as above.


## Mobile-versus-desktop count correction

- done — The catalogue MUST avoid presenting its current mobile and desktop totals as comparable distinct-view counts when John asks about the apparent difference. Current157/117 are entries: both include30wizard path/step variants, while mobile additionally enumerates OS/shared/error families missing from the desktop inventory. Publication wording corrected; no invented entries or forced counterpart pairs added.
- pending — The platform comparison MUST distinguish view families, variants, actions and browser/system states when final counts are published. Source-backed desktop reconciliation is incomplete; no defensible claim of40extra mobile views is made. Existing screenshots and explicit gaps remain available for inspection.


## Requested test deployment and desktop disclosure

- done — The desktop review MUST disclose shared field appearance and interaction changes when John asks what has changed before test deployment. Actual origin/main diff confirms joined units/outside cues, border/column fixes, inverse digit/keyboard/hold controls, Driver Info, pane/splitter repairs and shared dummy PR/count fixes. Desktop Driver/Editor review links supplied. Production remains separately gated.
- in_progress — The deployment checks MUST enforce the approved607appearance when old compact-oracle tests conflict with it. Four old test families require108px/separate units; reconcile the independent reference using the frozen approved preview, preserving geometry/mutation checks and no skips. No test deployment yet.
- pending — The test site MUST serve the tested candidate when John requests a test deployment. Refresh origin/main (currently T609), resolve the normal gate/rebase requirements, run candidate CI, publish through the standard test/snapshot path and verify its served build and saved-profile upgrade. Do not publish production.


Test-deployment preflight: the four old reference families were meaningfully red173753.
Frozen selected-build paint captured174541 (76specimens/58screens), geometry174528
(17contexts). After preserving exact checks and mutations, the full affected set had160passes
and3remaining old-palette assertions175338. Those3plus the one-channel mutation pass175708;
quarter-pixel rendering mutation passes175240. No app appearance source has changed. Final
reference type/lint and preservation pending; then the normal landing/test pipeline.

John's latest steering: stop desktop screenshot work. Do not generate further desktop review
images or send additional desktop screenshot links. Continue independent code/DOM preflight.


## Wizard interruption and catalogue comments, 27 Oct 18:16

- done — The Project Creation Wizard MUST omit the repeated unsaved-project warning when another project has edits. The original edits and the Projects list's existing Unsaved marker remain intact after cancellation.
- done — The mobile wizard driver list MUST keep the phone list inset when selecting a driver. It previously omitted the phone presentation prop and rendered the desktop list.
- done — The desktop Driver Editor MUST keep unit caps joined to the complete input outline and spinner buttons outside it when displaying wide units. Reproduced for Cms, Rms and six other wide-unit rows; shared detector previously checked glyph clearance but not complete input geometry.
- done — The desktop What-if panel MUST show the selected solid blue unit underline and inverse digit cursor when editing Mms. The old dotted underline is replaced by the explicit mobile-style decision; frozen independent references change only those requested paint properties.

Deployment stopped at 18:01 before candidate publication/main push after John's steering.
No desktop screenshots are being generated. Wizard regressions red181142 (all three reported
cases), green181312 (5 cases); wizard/project-row unit tests59pass181459; UI types pass181438.
Desktop geometry red181219: Cms unit ended23.31px before the input and spinner buttons covered
the input outline. Removing the independent input min-width lets the parent subgrid own the
complete joined box. Geometry and desktop Mms cursor cases pass181350; remaining unit test
revealed an obsolete child-index locator, corrected to inspect the actual unit slot.
Shared outline mutation red181411 proves the previous detector accepted this failure.
Broad shared DOM and unit-affordance verification is now running. No test-site deployment is claimed.


Verification complete for the reported corrections:161other shared DOM cases pass181455,
corrected outline mutation1pass181826,61unit-style/What-if cases pass181618,
warning text regressions2pass182116. The original mutation's width was absorbed by flex;
it did not prove detector effectiveness until the test disabled flex and independently
asserted the actual12px enlargement. This corrects the preliminary evidence note above.
Changed-file strict lint passes181732. Full preview source build passes181830; npm prebuild's
broader lint had instead visited old ignored generated bundles in packages/ui/build, not
application source. No generated artifacts were deleted or rules suppressed.

Local preview http://lap:4607 now serves v20261027T1818Z. Persistent Chromium mobile profile:
old controlled build1419 retained edited42.00L and its Unsaved marker; new worker kept the
old app usable while dirty. Saving and accepting the normal update reached the new entrypoint
with42.00L preserved, no startup errors, phone wizard list, and zero repeated warning banners
(verification182221). The earlier after-probe still saw the old dirty build as expected;
that is not a recurrence on the new bundle. Profile and records are in build/tmp.

Test deployment remains pending. scripts/visual/check-sources.sh requires baselines retaken on
exact current UI sources; scripts/visual/update.sh's whole-screen operation includes desktop
screenshots. John's stop on desktop screenshot work is still in effect, so that operation has
not been run and no source-hash stamp has been fabricated. Only the owned4607preview remains
running; no landing/capture job is left in the background.


## Requested Argon review of the existing image pairs

- done — The review record MUST distinguish the old pictured failures from current source repairs when John asks Argon to criticise the same images. gemini-4-argon-high via agy inspected10existing images (5pairs), returned SUCCESS in278.6s, conversation a77400b8-6089-44fc-905e-9941b7e230bb. Both image provenance and verbatim review are preserved. No desktop images were retaken.
- done — The review record MUST correct unsupported criticism when it conflicts with John's explicit decisions or measured geometry. Info was explicitly requested, so keep it. The editor underline collision estimate assumed20pxchips; actual measured28pxchips retain at least1.42px calculated clearance. Other hosts are not certified by that observation.
- pending — The desktop Driver Editor MUST show every displayed digit clear of its unit when valid values or unit choices change. Diagnostic80-rotation seeded audit confirms Advanced gamma248.87192 N/(A·kg) clipping even before rotation and air density0.00120095 g/cm³ clipping/overlap after rotation. The existing detector catches them once visited, but permanent scenario coverage currently missed these states. Parameters/Dimensions seeded cycles show no issues in this bounded probe. Fix and permanent regression coverage remain open; do not claim deployment readiness.

Review paths: docs/design/reviews/T607-argon-20261027-visual-comments.txt,
T607-argon-20261027-image-manifest.json and T607-argon-20261027-dom-audit.json.
The diagnostic scratch spec records measurements; its1completed test is not a conformance pass.
The earlier162/61passing cases are bounded evidence and do not override these newly reproduced
Advanced failures. No application source, preview build or deployment was changed by this review.


## Release completion and current galleries,27Oct19:24

- done — The desktop Driver Editor MUST keep full displayed precision clear of units when the seeded driver or unit choice changes. Parent value/unit tracks now reserve150px together, preventing an input-only overflow; narrow desktops use three/two columns. Permanent seeded unit cycles cover Parameters, Advanced and Dimensions. Red191552,40editor unit/layout tests green191702; all tabs at780/1024/1280 red191824 then3green191940.
- done — The local preview MUST retain the edited project when the fixed build replaces the old worker. Full build1920served on4607; persistent mobile profile save/update keeps42L and reaches the new entrypoint without startup errors (192306).
- in_progress — The test release MUST publish the corrected build when its candidate checks pass. Updated52visual baselines on the final UI sources; record source inventory after deliberate banner removal; standard landing follows. Production remains unchanged.
- pending — The mobile and desktop review document MUST show current-build captures when John opens it. Both full preview capture passes are running against1920 in an isolated staging directory, retaining same-project production references and per-image metadata/comments. User's explicit request for both galleries supersedes the earlier desktop screenshot stop.
- done — The number-control gallery MUST open current real app controls when testing the selected design. Primary page now embeds and links the actual component catalogue with inverse block selected; discarded interaction prototypes are preserved separately as history, with their written design intact. UI test coverage remains on actual NumInput and catalogue components.

Fresh capture scripts wait for the import toast to disappear before taking a frame. Staging
prevents the live review document showing old provenance captions beside new image bytes.
Type/lint checks pass191827/191943. Required local baseline update passes; deployment candidate
and gallery publication remain in progress, with no permission request or release claim.


## Final spacing repairs and release retry

- done — The fixed desktop unit MUST leave a readable inset inside the box when its symbol is long. Argon recheck of12fresh1920images found flush long fixed symbols; permanent DOM test red194219, fixed4pxinset and general right-edge contract green194328.
- done — The phone driver-library action row MUST span the list width when embedded in the wizard. Independent geometry test reproduced a107pxshortfall, then passes with the child filling its flex row. Touch705pxviewport also proves the wizard footer is fully inside the viewport and its Cancel button receives pointer hits.
- done — The virtual-time spinner test MUST compare values at the exact advanced clock instant when checking acceleration. Web-first value assertions while the virtual clock is paused retain the intended timestamp semantics while removing timeout:0; the gallery polling check uses the standard hang guard. Architecture timeout gate2pass193904 and3affected browser cases pass193907.
- in_progress — The test release MUST finish its normal candidate pipeline when all final-source gates pass. Earlier release-unit gate is now green (all related tests); the timeout architecture issue was corrected. Final UI build1943and60baseline cases pass; final UI types, source-hash gate and normal landing follow. No production change.
- in_progress — The review document MUST match final-source screenshots when John reviews the1943spacing repair. The507-image1920document is fully published with refreshed production comparisons, stable comments and immutable image paths. Final1943preview images are being refreshed; production2233references remain current. Number gallery uses actual components, and its published wrapper/working input/cursor/comments pass both browser checks193552.

Final assertion lint passes194940; virtual-time spinner test passes194943. No UI source changed after the1943build/baseline capture. Continue standard landing; final gallery captures remain isolated.


Release CI audit (27 Oct, candidate a503ce13c):
- Candidate rejected correctly; nothing deployed from this red candidate. Full run: https://github.com/Johnlon/openisd/actions/runs/40573569090.
- Real shared bugs reproduced: asynchronous digit selection overwrote select-all typing; cycling units re-parsed rounded text; calculated precision changes did not refresh; a cleared coupled field stayed visually blank while its unit held focus; native mouse text selection changed a horizontal drag's place value; Options hidden labels grew entire table rows; editor labels' click centres were covered by diagnostic buttons.
- Domain clear promotion falsely stated every floating-point digit as measured. Two new unit regressions failed, then all52related unit cases passed with explicit precision preservation/fallback.
- General DOM audit now checks label hit targets as well as actual glyph clearance, border paint, joined outlines and external cue placement. Hidden empty unit spans are excluded from containment checks because they have no painted box.
- Stale test assumptions repaired explicitly: labels are matched independently of concatenated unit/cue text; phone search uses its actual shared library textbox; phone filters are opened before measuring; Dummy PR is the required seed; button focus and inverse cursor replace native text-selection checks; explicit end carets select the last digit;16pxphone inset and124pxcomplete desktop joined boxes replace the old separate-unit dimensions.
- Repository source discovery uses git's file list with native traversal for standalone fixtures; no runner dependency on rg. The historical source-index pointer is excluded from the retired-machinery reference test, as the underlying bugs archive already is.
- Twenty drag/marker/panel cases pass202303;95filter/wizard/editor cases pass201919, with the two remaining editor cases covered by subsequent fixes. Final geometry, persistence, build, refreshed galleries and candidate run remain in progress.

Final source2032:52clear/precision unit cases,57cell/inventory cases,18coupled-value/dialog cases,20drag/marker/panel cases and19final label/rotation cases pass. The inspector's three new containment checks failed at780/1024/1280before the layout fix; the complete10-case inspector spec now passes. All typechecks pass. Final60baseline update passes and records the source hash. Full authored-source lint passes; generated package-depth build directories now follow the existing build-output exclusion. Live preview4607and real-control gallery are2032; immutable2032mobile/desktop capture refresh runs independently of candidate CI. Old test2106persistent browser contains an unsaved42Lproject, ready for normal update verification. Candidate pipeline is being retried; production remains2233.

2032gallery is fully published:274entries,507images independently decoded,138mobile/116desktop preview captures,137mobile/116desktop production captures, no unexpected failures, and both published-document tests pass204139. Gemini reviewed five pairs; root rejected its missed wrapping regression and incorrect readonly characterisation. New Advanced single-line test is red-before/green-after;40affected checks pass204440. Real number-gallery hosting pin is now shared with production's controller;12spinner variants and43existing rendition/catalogue checks pass204819. Final image refresh follows this source freeze.
Landing remains blocked by locked T008 integrity hash. Automatic approval review rejected changing the hash without explicit user permission. An asynchronous approval request is pending; no hash update or deployment has occurred. The existing gate exception is committed on the task branch, not applied on main.

FINAL HANDOVER STATE —21:00UTC27Oct
The app preview4607and both review documents now use final buildv20261027T2049Z. The visual document contains507decodedimages with one consistent preview build, production2233and the same frozen project hash,274declared entries and explicit unavailable/native-surface gaps. Final document and real-control iframe browser checks2pass205918. Final types, lint, inventory9cases and60baseline cases are green. Gemini's final three desktop pairs are beneficial and confirm the label fix; root independently concurs. The two reviewed phone images are byte-identical to2032. Twelve new gallery keyboard-dismissal cases plus43existing catalogue/rendition cases pass; forty affected label/geometry checks pass.
Release is NOT deployed. Test remainsv20261026T2106Zand productionv20261025T2233Z(verified20:50UTC). Full candidate CI was red on the earliera503candidate; its failures have targeted repairs, but a new full candidate has not started because the locked T008 gate refuses its intentional historical-index exception. Automatic approval review rejected updating T008's hash without explicit user permission; the asynchronous question remains pending. Exact proposal: build/tmp/t607-release-approval/explanation.txt. Do not bypass or silently apply the hash. If approved, update that hash and include tasks/T008.yml in T607's allowlist, then run the normal land pipeline. If green deploys test, run the saved-profile after check: bash scripts/quiet-test.sh node build/tmp/verify-test-release.mjs after. Its before profilev4has an unsaved42Lproject on oldtest2106.


## Gallery family layout and selected driver Type — 27 October 22:52 build

- done — Every catalogue family MUST share the numeric value-column left edge at phone360/374/412. New DOM audit enumerates all96forms, checks unwrapped labels, alignment, visible text-control borders/approved typography, unit-content clearance, exterior warning/model cues and row containment. Red all-family audit reproduced John's choices and wrapped Value reports; green225034 passes all288form/width contexts.
- done — Generic controls MUST use the same joined frame when shown in the actual-component gallery. Legacy UIPickField had no data-field attribute, so numeric-only joined selectors missed it. Explicit joined-field opt-in preserves real field metadata. One shared label width replaces inherited auto columns; warning buttons get the numeric style; native input margins are removed; checkbox/colour/textarea retain their own forms; readonly meter reserves its unit cap.
- done — A DQ cue MUST leave the label readable when the warning is outside the input. Legacy padding34px plus new margin22px double-reserved space and wrapped Value; explicit4px label padding eliminates the overlap. Older tests returned wrap findings without asserting them and checked numeric paint only. Existing43catalogue/rendition and12pin cases passed224858; new3all-family cases pass225034.
- done — Selected driver Type MUST start at the value column's left edge when opened through the wizard, picker or Info panel. Summary rows now declare an explicit enum kind; numeric rows retain their right-aligned number/unit rails, text rows align left. Generic summary glyph audit failed before the fix and passes seven route/viewport cases225256. Driver display unit tests pass; final UI typecheck/lint pass.
- done — The review preview and real-control gallery MUST serve the corrected build when John opens port4607. Builtv20261027T2252Z replaces the prior2049preview; primary number-gallery wrapper records2252. Existing274-view screenshot document remains explicitly frozen2049; it has not been represented as refreshed by this focused correction.
- done — Before/after screenshots MUST show the same selected summary and reported choice variants at374px. Nine2049/2252pairs are published at build/ui-contract/gallery-layout-repair/, with18individual comment threads. Root compared every pair and judges all nine corrections beneficial. Capture and published actual-control iframe checks3pass225434. Initial recorder failures were worker takeovers and then an incompatible blocked-worker environment; the final captures use normal workers and wait for first installation to settle, with clean browser diagnostics.
- done — Gemini MUST critique the focused before/after correction after captures finish. Conversation861038ef-9a79-4d63-b7d1-82948bf45de1 reviews five pairs plus source. Full response and root dispositions are appended to docs/design/reviews/T607-argon-20261027-visual-comments.txt. It found detached checkbox cues; the new general6px maximum-gap assertion is red225921/green230001 for288form/width contexts. Other styling alternatives remain approval decisions. Each of the nine original corrections is beneficial in root comparison; broader correctness is not asserted.

Required60baseline update passes225213 and source hash records the final source. Test deployment remains blocked by the previously reported T008 integrity-hash permission boundary; no permission is inferred from subsequent UI reports. No production change.

Generalised summary audit57screen cases pass225712. Final checkpoint: c37802ce0 preserves the first repair. Additional checkbox-cue adjustment is being published asv20261027T2300Z; all96forms at3widths pass with the tighter cue-distance test. Shared-field baseline source hash matched after the first repair; the final60baseline refresh is running.

Final2300verification: new upper-bound cue-gap audit passes all288form/width contexts;2252/2300checkbox pairs are added to the focused comparison page, now11pairs/22individual comment threads. Root inspected both new pairs; the cue-distance corrections are beneficial. Published iframe/input/cursor and checkbox recorder checks2pass230230; final60baseline cases pass230222. All canonical driver Type labels fit at374px (probe230150); this bounds rather than assumes the reviewer's long-label hypothesis. Source lint passes. Final UI typecheck passes230251; required baseline updater completed and recorded the final source hash. All authored repairs are committed after these checks. No worker blocking is used in final captures.


## Gallery comments c49 onward — repair queue

- done — The desktop chamber and vent controls MUST stay within their own columns when any enclosure type or chart is opened. Evidence: c54,c56,c60,c62,c64,c65,c67,c68,c69,c71,c72,c73; prove descendant bounds and cross-column glyph/control nonintersection at1280/1024/780 before and after.
- done — The desktop chamber headings MUST retain visible banner backgrounds when the two-chamber vents tab opens. Evidence: c62,c67; deterministic background/border checks.
- done — The desktop passive-radiator fields MUST keep consistent box widths when parameters or options are shown. Evidence: c54; compare input/select geometry, preserving intrinsic unit width.
- done — The desktop What-if and Revert buttons MUST use the right rail without a repeated colour legend when any project tab opens. Evidence: c58; What-if at top, Revert right aligned; unsaved status beside the bottom legend.
- done — The mobile Project description MUST fill the available page width when Project details opens. Evidence: c50; screenshot and native geometry checks.
- done — The mobile Alignment selector MUST start at the numeric value column when the alignment sheet opens. Evidence: c52; sealed and vented selector alignment.
- done — The phone Options pressure value MUST remain readable when the General tab opens. Evidence: c76; compare alternate display units/precision and unit clearance.
- done — The Options storage counts MUST align in columns when Your data opens. Evidence: c78; label/value geometry check.
- done — The desktop Plot Window spinners MUST match other desktop number controls when Options opens. Evidence: c80; compare actual standard component paint and interaction.
- done — The Driver Editor dimensions drawing MUST use the approved stronger basket outline when Dimensions opens. Evidence: c75,c77; compare T418round3 alternative, verify shared drawing in both skins.
- done — The Project action-sheet caption MUST explain how to open the view when its screenshot is inspected. Evidence: c49; route Menu → Projects → project row menu explained in chat; improve caption.
- done — The commented gallery views MUST show the repaired build and production comparison when the document is updated. Evidence: Capture only commented views plus related checks; all image provenance correct, comments retained, personally compare, Gemini critique.

Comment snapshot: build/tmp/t607-comment-repair/comments.json. No prior pass closes these newly reported defects. Release gate permission boundary remains unchanged.

Evidence through final2325source: desktop column/PR/banner red231011, initial20-context green231106; rail red231215 andgreen231330. Phone description/alignment/Options glyphs red231352,12description/alignment cases pass231657; exact outline/profile red231741,12new outline/spinner/Options/alignment cases green231817. Broader Options46cases pass232512. Generalised desktop regions22cases pass232554, and the stable-height/1280-fit3cases pass232448 after the broader72-case run caught one intermediate height regression. The other71cases in that run passed, including all Project-sheet and shared-diagram regressions. Final source lint and UI types pass; related58unit cases include57initial passes and the refreshed source-index9case pass. Required60baseline cases pass232639. No test was skipped or weakened.

Root reviewed the reported box/vent/PR, Project details, alignment and Options production/before/after image families. The desktop columns no longer overlap, banners return, consistent PR boxes fit, and all three ABC port groups are visible at1280. Production has the same pre-existing short Description and clipped pressure; those defects are now corrected. Pressure retains its value/precision and text size. The96px Options label profile trades some long-label word wrapping for readable full values; it does not split labels midword. Storage uses one value column for stable right alignment, with additional vertical scrolling. Those visible tradeoffs are shown rather than hidden. Production references also show its cloud invitation and older ReplaceMe/empty-Qms seed; these are pre-existing differences already explained by this task, not new calculation changes in this repair.

Focused22-view production/before/after page: build/ui-contract/commented-surface-repair/. Full gallery captures are refreshing on2325so the document will not mix old/new preview builds. Oldproduction2233references were re-verified live. Gemini is reviewing all22before/after pairs. Release remains blocked by the existing unapproved T008 hash update; no landing control was changed or bypassed.

Full review publication completed: immutable build/ui-manifest/review-v20261027T2325Z-comments and canonical mobile-visual-draft now contain274declared entries,138mobile/116desktop preview captures,137mobile/116desktop production references,507decodedimages and preserved topics. All254captured preview records identify2325; two cloud views explicitly unavailable in this local configuration. The first full refresh lost its tool-owned preview process toSIGTERM midway; failed captures were preserved as attempts and retried after moving the preview to the managed openisd-t607-preview.service. Final capture records have no unexpected failures. Service is active on4607and serves2325.

Gemini's44-image review reached its6-minute print deadline and returned an empty response despite statusSUCCESS. This is NOT a review pass. Conversation0b96a493-9575-4b9d-a350-708722a90358 has a bounded follow-up requesting its actual findings with no further tool calls. No release/deployment or integrity-hash claim is made.


Gemini completed all22pair verdicts after a tool-free follow-up (0uninspected). Its report is preserved in the visual-comments review file. It found two real regressions introduced by the repair (extra storage height and narrower Plot Window colour labels) plus remaining native End Correction truncation. New native text/arrow and compact two-column storage/single-line-colour-label assertions reproduce the real problems before the corrections. Full labels remain in option titles; coefficients remain0.613/0.732/0.849. PR heading/cue overflow does not reproduce under the expanded DOM header audit; no needless bar change was made. The mobile SVG is below the fold, reachable by scrolling; second-frame capture makes that explicit. Required final checks, fresh images and final narrow recheck are in progress.

Final critique corrections are verified on build2346. Native select text+arrow space, restored2-column storage, single-line Plot Window colour labels and existing standard-width/PR header cases7pass234625. Expanded DOM/Options domain62cases pass235017; every Plot Window input can be scrolled fully above the footer at360/374/412(3cases235142). All design/persistence/UI typechecks pass; targeted registry/precision/column/inventory29unit cases pass; final source lint passes;60baseline cases pass234741. Gemini final narrow recheck returns no blockers and beneficial verdicts for all5repaired surfaces. Its remaining PR/vent header pixel estimate is rejected by actual heading-bound measurements and images. No app source changed after2346build.

FINAL2346PUBLICATION: canonical mobile-visual-draft and immutable review-v20261027T2346Z-comments now show274declared views,254current preview captures(138mobile/116desktop),253production reference captures(137mobile/116desktop), and509independently decoded image files. The extra2images are full scrolled phone diagrams, one production and one preview; view counts are unchanged. Every captured preview record is2346. Two local cloud surfaces explicitly unavailable; no unexpected failed captures. Focused22view comparisons now contain68production/before/after images, including diagram detail. Original topics retained, silhouettes reference linked, actual control gallery2346. The full desktop tool-owned recorder was also terminated and was resumed as a managed capture job; the managed preview remains active, and all snapshot jobs have completed. Code secured in47a157e52anddd09049f3.

No app source changed after2346. Final published-page browser verification follows; independent Gemini recheck of its5corrected findings returned beneficial verdicts with no blockers, supported by root comparison and DOM evidence. Only normal below-fold content remains in the Plot Window initial image, with all inputs proven scrollable fully clear of the footer. Required62domain,3scroll,29unit,60baseline,full typecheck and lint results are green. Test deployment is still not authorized past the existing rejected T008hash boundary.

Final published pages verified235834:3browser cases pass (all274view entries,509image elements,255preview figures all2346,509unique topics, lazy composer works after scrolling, first preview image decodes in browser,22focused comparison sections/68images with composers, actual number input and inverse cursor work). All509files also decoded individually before atomic publication. No required UI repair or publication work remains. The separate test deployment remains blocked only by the unapproved integrity-hash change described above.


Latest desktop corrections (28 Oct):
- done: The Driver advanced boxes MUST have equal widths when shown together; the environment units MUST align when the Advanced tab opens. Evidence: red reproduced unequal outlines and unit columns; green width+glyph test and environment geometry checks pass.
- done: The simulation options MUST sit between the environment and bug switches when the desktop Advanced tab opens.
- done: The sixth-order vent fields MUST show labels to their left when the vent tab opens.
- done: The preview MUST show these corrections when reopened, with before/after pictures and passing regression checks.

Verification: new cases reproduced the reported geometry failures. The affected-domain run passed74cases and exposed two obsolete two-column assertions plus a1.1px panel-height regression. The old assertions now enforce the requested one-column environment and clear adjacent options gap; wrapper spacing fixed the real panel regression. All8affected follow-ups pass; the narrowed Driver values/units content check passes.12targeted units, full design/persistence/UI types, final UI types and lint pass.60visual baselines refreshed; only Driver and Advanced snapshots changed. Sixth-order left-label and field bounds pass at1280/1024/780; its whole pane fits1280. Live managed preview is v20261028T0026Z; no test deployment claimed.

ABC investigation: actual browser canvas/DOM width budget with six significant digits, full one-line labels, unit caps, spinners and all select options requires1246.26px. Current pane972px; moving both actions to a bottom row gives1065px, still181.26pxshort. This answers the proposed rearrangement under those constraints; ABC and live button placement are not changed without a chosen alternative. Evidence build/ui-contract/advanced-layout/abc-width-budget.json, passing probe t607-abc-bottom-buttons.log. No stored precision or calculation rules changed.

Three same-project production/before/final screenshot sets published at build/ui-contract/advanced-layout with a composer below each image, root visual review and explicit per-build labels. Production cloud/banner/legend/units differ for earlier known release changes; this turn only fixes the described desktop group alignment. Gemini six-image review returned: Advanced and sixth-order improved; driver inner-divider mismatch found and accepted. A new unit-cap equality assertion failed before the fix, then all3driver tests passed with common60pxunit caps, including actual value clearance and blank/Escape behavior. Final UI types/lint/build pass. Root inspected the corrected driver image. Final preview0031 replaces0026; the comparison page contains fresh0031images.

Final0031verification: all3driver cases pass; second required baseline refresh60passes. Comparison images decode and composers were verified; final refreshed page verification recorded in t607-advanced-comparison-reviewed.log. The three UI corrections are complete locally. ABC remains a measured layout decision; bottom-row actions were evaluated in the browser experiment only.

- done: The ABC port fields MUST show labels to their left when the ABC tab opens, with all three port groups visible. Evidence: extend the sixth-order DOM regression to ABC, then verify containment, full labels and the live comparison.

Current user-approved scope: all four ported desktop panels use the new ABC grouping; passive-radiator panels explicitly unchanged. Fixed column geometry must remain stable for round/slotted ports. Tests exposed and fixed the sixth-order slotted overflow. Shared port template now replaces the separate single-port template. Eight mobile slotted alignment cases pass at360/412. User corrected terminology: tuning frequency is a two-way solved pair with length, not always an input target. Existing Box page frequency fields remain, and port fields share their cells; no new stored setting. Rear/Front appear on sixth-order/ABC, Intra has no independent tuning cell.

- done: The editable number box MUST spin on a horizontal mouse drag started anywhere in its value area, including selected digits and blank padding; native text dragging must not steal the gesture. Evidence: selected-text mouse regression before the fix, then full drag/caret interaction checks.


28 Oct follow-ups:
- done — Desktop Driver Model MUST be 420px and PR name 330px with actions visible. DOM checks and frame20cases pass t607-save-rail-green.log.
- done — Advanced Sound velocity/Air density MUST occupy a second aligned column. The regression failed with the old one-column layout;13affected checks pass t607-columns-final.log after the full66case run found15px overflow. Equal146px boxes and8px column spacing fit the existing panel; options sit below the air fields and compatibility switches stay right.
- done — PR picker MUST match Driver picker position. The new y-position assertion failed at0vs92.5; centred overlay passes in the65passing cases in t607-columns-center-green.log.
- done — A green Save MUST sit6px above Revert and save the current project. Missing-button red, fullframe20case green including dirty-state clearing.
- done — Default frequency range MUST be10–1000Hz, including toolbar Reset. Fresh-state unit failed at20000Hz;46affected unit cases pass t607-frequency-default-green.log. UI types/lint pass; live preview v20261028T0148Z confirms the10–1000Hz axis.
- done — Fresh before/after Advanced and PR images are published at build/ui-contract/desktop-followups, with the same project, build labels and per-image comments. Root inspected both after images. Gemini review and browser page verification follow below.

Final follow-up evidence: 20frame cases,13Advanced follow-ups,65other Advanced/PR cases,46unit cases, types and lint pass. All60visual references refreshed on final sources. Green Save clears unsaved state and disables Revert. Fresh captured preview0148 shows the new range and all requested controls.

Gemini final visual cross-check: Advanced and PR pairs pass with no overlap/clipping. Note accepted: ordinary simulation options now sit below air inputs; enabled green Save matches existing toolbar behaviour. Review recorded in docs/design/reviews/T607-argon-20261027-visual-comments.txt. Comparison-page browser check passes: all6images decode at1280px and the comment composer is visible.

28Oct correction: John requires the standard checkboxes in column3, then compatibility groups. The earlier below-air placement is rejected. Two geometry assertions reproduced that rejection. Restore horizontal order; retain1600/1920 no-scroll containment and add explicit1280 scroll-access checks because five nonwrapping groups exceed that pane width. Do not reduce fonts or crowd numeric values to fit.

Column3 correction: live v20261028T0205Z, source restored to horizontal flow.50Advanced cases pass; wide1600 follow-up and1280 scroll access pass.1440 access initially differed by0.313CSSpx due integer scroll offsets; assertion now allows1px rounding, matching existing layout tolerances.60visual references pass; only desktop Advanced picture changed. Before/after at build/ui-contract/advanced-column3; previous review page marked superseded. Root inspected the1600after image: all requested groups in order with no overlap.

Column3 complete:1440scroll-access follow-up passes, UI types and final lint pass. Gemini independently confirms the requested column order with no clipping/overlap at1600. All checks complete; preview0205 and before/after gallery available.

Compact ports requested: Shape must share row1 with tuning and count share row2 with diameter/slot width. Keep numeric control widths and fonts. Port groups need388px to retain left labels; verify all four ported panels at1600 and existing region checks at1280/1024/780. Separate selector row removed; reduce shared floor272→244 and vertical padding10→7 to accommodate slotted controls without wasted blank space. Initial red confirms old shape labels/row placement; first implementation saved the selector row but required248.5px, prompting padding reduction.

Exploration instruction: John explicitly suspended test runs and test repair. Latest preview proposal: Shape on row2, Number on row3 below it; Shape85px (+25%); all port numeric boxes93px (-25%) with unchanged fonts. CSS grid places selector rows independently for round/slot. This exploratory revision is intentionally not test-validated; earlier test results do not attest to it.

28 Oct native editing correction:
- done: The numeric input MUST visibly select its contents when the user double-clicks or selects all, and replace/delete that selection when typing or pressing Delete. Evidence: two regressions failed on transparent selection before the fix; all21caret/drag browser cases pass in build/test-logs/20261028-041648-284005.log.
- done: The numeric input MUST preserve ordinary drag spinning when the user drags horizontally, including from selected text and blank padding. Existing mouse/touch drag checks pass in the same21case run; no modifier gesture introduced.
- done: The numeric input MUST keep a native range selected when the user Shift-clicks. Range selections hide the inverse digit marker; only single-digit spin selections suppress native highlighting.
- done: The Driver Editor MUST place help at the right of each heading and explain core versus optional chart fields, c and rho when help is opened. Focused help regression passes in t607-editor-help-green.log; labels remain c and rho.
- done: The preview MUST expose these fixes when opened on port4607. Built v20261028T0418Z to release-native-selection;80caret/spinner unit cases, UI types and changed-file lint pass.
- open: Closed bug reports MUST leave the active bug list once their fixes are complete. Archive audit selected183unambiguouslyclosed records and held14pending/partial records; no archive moves yet.
- open: The test deployment MUST include the approved T607 changes after release checks pass. Exploratory port-layout assertions/baselines and the historical-index locked-gate issue remain unresolved; this preview is not a release.

28 Oct user retest correction: the previous21case pass did NOT prove ordinary mouse-drag selection. John reproduced Vas spinning while trying to extend a selection; triple-click still selects. Added an actual press-and-drag across Vas regression, including unchanged value and Delete. Gesture distinction between selection and spinning is awaiting John's response; no gesture implementation or preview change made in this follow-up. The earlier claim of restored normal mouse behaviour was too broad.

Overnight completion (28 Oct):
- done: Desktop number boxes MUST select text on horizontal mouse drags and spin on vertical mouse drags, while phone vertical drags scroll without stepping. User approved the distinction;22interaction tests pass (t607-direction-green.log). This is OpenISD behaviour, not WinISD parity.
- done: Closed bugs MUST leave the active list when already resolved.181historical records moved to bugs/archive, relative Markdown links preserved, active document references updated. Current-release/ambiguous records retained. Audit: build/tmp/t607-bug-archive.json.
- done: The active view catalogue MUST omit archived bug reports while retaining active documentation.9inventory tests pass. The original T008 gate is restored byte-for-byte, checksum f95b02da10963c082b3fe9b15818a595dbc262f4b4100eb030409021de96f200, and passes without any checksum exception.
- superseded: Build0435 reserved DQ by globally widening tracks; John rejected the excessive gaps.136contracts and37port cases passing did not make that acceptable.
- in_progress: Desktop labels MUST reserve only necessary warning space without wrapping or moving when DQ appears. Build0438 removes global widening; PR symbols retain36px label+22px rail. PR warning transition passes; added explicit compactness and single-line checks and rerunning desktop audit.
- open: Review galleries MUST show the final approved spacing and current build. Number gallery temporarily points at0435; desktop capture interrupted after John's rejection; mobile capture reused old records and must be refreshed from the actual captures/preview directory. Refresh only once compact spacing checks pass.
- open: The release MUST pass final lint/types/architecture, refreshed visual sources, independent Gemini review, candidate CI and installed-app upgrade verification. No new test deployment yet.


Handover 28 Oct — current status supersedes older completion claims:
- done: Independent reviewer checked 271 routes on0446 and verified four layout fixes with76follow-up checks on0457. Report: build/tmp/independent-ui-review.md. Coverage is bounded, not a blanket release approval.
- open: Latest single-character native-selection fix has36passed/4failed browser cases; not published. Log: build/test-logs/20261028-050222-388139.log.
- open: Refresh galleries, final checks/baselines, Argon visual follow-up, commit and land, then installed-app upgrade verification. No new test/production deployment.
- done: Handover written at docs/handover/HANDOVER_20261028_T607.md. Live preview verified v20261028T0457Z at http://lap:4607/. Former T008 checksum blocker resolved without exception;181archive moves remain uncommitted.

28 Oct resumed after handover:
- done: The four numeric interaction failures MUST be resolved without weakening their assertions. Fixed reverse-Tab restoration from unit/spinner and distinguished Shift selection from Shift+Tab; sub-threshold click keeps spin-digit marker. All40caret/rendition/drag browser cases pass, including single-character select-all editing. Evidence: build/test-logs/20261028-105115-523052.log. Source not yet published.
- in_progress: Independent reviewer MUST visit previously unvisited reproducible states and long mobile content. User explicitly requested expansion; /root/independent_ui_review accepted, will report evidence and distinguish account/native-device restrictions.
- done: Numeric fixes MUST be available on the preview after passing checks. UItypes/focusedlint pass (20261028-105158-524871.log), build passes, live version verified v20261028T1053Z from build/release-selection-return. Additional vertical-first touch-boundary regression passes with14drag cases (20261028-105357-527086.log). Physical-phone behavior remains separate.
- done: Spin-release edge case MUST retain the spun digit when returning to the dead zone with sideways movement. Added native mouse regression passes withall15drag cases (20261028-105609-530240.log). Number-control gallery republished for1053; generated version/iframe/comment composer verified. Screen gallery refresh remains open.
- done: Update UI states MUST be exercised in both skins rather than left unvisited solely because the live preview omits the scripted host. Existing dedicated-host app-update spec passes10cases (20261028-105744-533036.log): clean auto-reload, unsaved offer/Not now/reoffer, Keep/discard confirmation, refresh retention and About. Actual persistent-worker upgrade remains open.
- done: Missing service-worker registration MUST not crash the app. Supplementary review exposed undefined registration; regression red then28telemetryunitgreen, UItypes/lint/buildgreen. Published1102and verified2live blocked-worker browser cases including project import, no crash. Logs: t607-blocked-worker-red.log, t607-blocked-worker-green.log, t607-state-review-build.log, t607-blocked-worker-live.log.
- done: Completed stored-data repair MUST not be falsely described as running-code fault. Independent review confirmed;2browser cases red then green. Corrected both desktop/phone no-repair hints, preserving backup and project-retention assertions. Log t607-repair-message-green.log.
- done: Saved-driver editing MUST work without a project. Independent1102comparison red; gate now allows myDriver detached drafts while retaining project guards for project editing/What-if.6library cases pass including edit/cancel/no-project/data-retention (20261028-111124-550927.log). Fixture compares entries because existing envelope normalization drops schema metadata.
- done: Preview MUST contain these audited-state fixes. UItypes/lint/build pass; live verified1111from build/release-audited-states. Number gallery label matches. Final independent focused recheck pending; full release and screen-gallery refresh still open.
- done: Independent reviewer MUST confirm the last two state-audit fixes on the actual preview. All4focused checks pass on1111; screenshots inspected, saved-driver edit with/without project and desktop/mobile repair outcome verified. Evidence: build/tmp/independent-ui-final-1111/, 20261028-111237-552258.log; supplemental report updated. Account/native-device and real-worker upgrade limitations remain explicit.

Desktop project list request:
- done: The project list MUST show the project name, box type and volumes on separate readable lines when the desktop panel is narrow.
- done: The enlarged colour indicator MUST rotate to a different unused colour when clicked once, including when all standard colours are occupied. Other projects must retain their colours and focus.
- done: The colour indicator MUST open the colour picker when double-clicked without also rotating; the row menu colour action MUST open the same picker.
- done: The preview and comparison gallery MUST show the verified result, with same-project before/after evidence.
- done: The project context menu MUST copy the focused project’s chart definitions to the chosen project when requested, without changing focus, design inputs or trace colour. Closed saved projects must be supported too.

Project-list evidence: preview v20261028T2336Z, build/release-project-list; comparison build/ui-contract/project-list/index.html.14 new browser cases pass (t607-project-list-timing-green.log),18 existing cases passed in t607-project-list-final-browser.log; summary/colour/copy18unit, notification/bin20unit, row-model14unit. UItypes/lint pass. Independent live review and Argon visual review pending. No test/production release.

Final project-list preview2342 supersedes2336. Independent review exposed colour loss on close/reopen; selective chart-view persistence now updates stored view without saving unsaved acoustic edits.16browser cases pass (t607-project-list-persistence-green.log), types/lint pass (t607-project-list-persistence-checks.log). Argon reviewed production/before/after; checkbox and dirty marker alignment findings fixed with red→green geometry regression. Final live recheck pending.

Independent final2342review:4checks pass, including distinct-colour open/closed target preservation, unsaved-volume discard (12.30L restored, chosen colour and2charts retained), and narrow ABC geometry. Argon final visual recheck confirms both alignment findings resolved; build/ui-contract/project-list/argon-final.json.

Final tracked project-list suite:17/17 pass (`build/test-logs/t607-project-list-final17.log`), including unsaved-design discard isolation. Independent review complete, no unresolved confirmed issue in this bounded change.

John rejected the large circular colour swatch and requested a narrow inset rectangle down the left side. Replaced it with a4px full-row vertical rail, with4px top/bottom breathing room. Moved the show checkbox into an adjacent dedicated16px column. Build v20261029T0011Z is live at4607; final gallery image refreshed at build/ui-contract/project-list/. No tests run for this visual-only adjustment.

Final project-list polish v20261029T0021Z: native picker input is repositioned beside the double-click/menu trigger; name and box type use single-line ellipsis; unsaved marker dot and amber side stripe removed (pale yellow row background remains); project row floppy Save button under ellipsis saves the chosen dirty project without changing focus; trace-colour rail reduced to3px. UI typecheck and lint pass; rebuilt and captured screenshot. Per current instruction, no tests run for these final visual changes.

Latest project-list/generator preview v20261029T0036Z. Save icon only appears for dirty open projects; selected-row icon is a white outline floppy directly on blue, without a white tile. Unsaved amber border/dot are removed; pale yellow background remains. Inset trace rail widened to5px. Names and box type truncate on one line. Generator checkbox, numeric frequency, Hz and spinners share a nonwrapping row; sidebar minimum is200px. DOM capture verified row scrollWidth==clientWidth (180px). Current screenshot/generator crop in build/ui-contract/project-list/. UI typecheck and build pass; no tests run for these final visual changes.
