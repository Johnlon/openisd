# Field appearance catalogue

Status: DRAFT — John must approve the use cases before adoption.

27 October ruling: the separate-unit compact appearance is rejected; wholesale adoption
is paused. John authorised restoring production-style joined value/unit boxes, retaining
⚠ outside left and ≠W outside right after the spinners/dropdown, and preserving independent
functional fixes. The app's restored preview is http://lap:4607/ and its component examples
are http://lap:4607/?field-catalogue=1. The older HTML remains a record of the interaction
experiments, including the selected inverse cursor; its separate-box paint is discarded.
The catalogue combinations still require John's approval. Exact paint assertions tied to
the discarded draft are not a valid approval of the restored cases and must be reconciled
before landing; they are retained rather than hidden or weakened.

The review is one HTML page, `field-use-cases.html`, with 20 interactive proposed cases.
The broader matrix and page-audit work are retained; neither is an approved appearance standard.
Owner ruling: John, 26 October 2026. Stacked labels are rejected. Fields must be narrower,
DQ outside immediately left of the field, and the model-difference cue outside immediately
after the spinners or dropdown. Preserve compact row depth and avoid label wrapping where possible.
Once John approves the catalogue, a production field form outside it is a conformance failure.

## Latest mobile single-row ruling — 27 October

John rejected the extra narrowed boxes: “the narrowed ones look weird”. Driver must use
the fuller production-style boxes again. The narrowest-card width cap and the three-page
column-offset experiment are dropped. Their exact-width test is superseded by control
appearance/inset checks; this is a human-directed appearance change, not a skipped test.

Scope is **mobile only**, across tabs, editors, sheets and popups. Every single-row scalar
field must use the same horizontal spacing for its intrinsic type. DQ and model-cue slots
must remain reserved when the cue is absent; cue appearance/disappearance must not shift
the label, box, unit or spinners. Same type means same font profile, border, height, inner
inset and unit treatment; it does not mean shrinking all boxes to the narrowest container.
A multiline notes field remains multiline; a compound min/max row is recorded separately.

| Part | Shared mobile definition |
| --- | --- |
| Inner text inset | 16px, shared by number boxes, readonly values, short dropdowns and text fields |
| Numeric control height | 34px within the existing40px row |
| Outline / corners | Existing joined production style;4px corners; preserve mandatory/DQ/focus states |
| Unit segment | Existing40px minimum or60px wide symbol segment; fixed and toggle semantics retained |
| DQ rail | 26px reserved for ⚠ even when empty |
| Spinner area | Existing90px area when used; tap/hold/scroll gesture repair retained |
| Model rail | 24px reserved for ≠W after the spinners or dropdown, even when empty |
| Label | Existing short/medium/wide label presets; wording retained; avoid wrapping |

The control inset and both cue-rail dimensions are now common design tokens. The
permanent cue rails are **not yet claimed applied everywhere**: an unanswered placement
question asks whether the left ⚠ rail stays between label and box, or precedes the label.
That choice changes how much mobile width is available without repeating the rejected
narrowed appearance. The current app preview restores the fuller Driver first.
The general field-catalogue use cases still need John's approval; no wholesale adoption.

Source discovery covers UIField/UIPickField, native mobile form rows, Driver Editor,
Options, Tune/What-if, port fields, project metadata and the wizard. Source discovery is
not runtime coverage. Current automatic checks cover the main three tabs, numeric Driver
Editor tabs, Options, Box losses and sheets; remaining native/search/compound contexts
must be reconciled before claiming all mobile inputs conform.

## Intrinsic properties versus current state

A field's semantic declaration supplies value kind, allowed editor (number, finite choice,
text, multiline, boolean/error toggle, colour or range), units and write capability. Its
binding/context supplies whether this particular occurrence is writable. A calculated
provenance does not imply read-only: linked calculated quantities can be edited. A stored
value can be displayed read-only. Disabled is temporary unavailability, not read-only.

Units are none, fixed, or switchable. Only quantities (including numeric choices/ranges)
can have quantitative units; text, booleans and colour values cannot. A read-only quantity
may still have a switchable display unit. No-unit fields must not pretend an empty unit
control is clickable. Count fields are finite integer choices and must use the same native
select and domain-generated options everywhere; a count is not a continuous measurement.

DQ and model difference are independent: neither, DQ only, model only, both. Each cue needs
a real diagnostic or registered model-difference reason. Valid values may have a model cue.
An invalid/missing field may have no model difference. DQ belongs to the value; the model cue
belongs to the applicable model/context. A model cue must hug the last actual control,
not a grid position that leaves it floating in the middle of an input.

## Required base forms

For each supported semantic/editor family, enumerate every allowed tuple of access × unit
kind × DQ × model cue. Numeric input and readout each require all three unit kinds and all
four cue states (24 tuples). Count dropdowns have no units in the current registry. Numeric range controls are a
proposed auxiliary form, not a registered current application field. Textual choices have
no quantitative units. Do not generate model cues or diagnostics for a family without a
meaningful reason: boolean controls have no numeric DQ, intentional bug switches do not
need a duplicate model cue, and text/date diagnostic forms do not imply a model difference. Read-only finite choices show their chosen label, not an enabled
select. Booleans remain native checkbox indicators; error-reproduction toggles retain their
separate intentional warning treatment. File-open/import buttons are actions, not value fields.
A new native/editor kind is illegal until declared and illustrated here.

Required state overlays: present/missing, required/optional, enabled/disabled, focus,
entered/calculated/defaulted provenance, DQ root/symptom. Apply only logically compatible
states: missing has no numeric glyphs; a read-only field has no editing stepper; the unit
can remain switchable even when the value is missing. Multi-line text wraps by definition;
ordinary labels should remain on one line when they fit. No semantic state may be inferred
from a CSS class, colour or a current numerical value.

## Proposed compact candidates

The gallery will compare current/prod and compact alternatives on every page. Numeric
value boxes are narrow and stable, read-only boxes use the same value width as editable
ones, and units/cues occupy explicit slots outside the number box. The candidate separates
number width from unit width, so narrowing a field does not hide its meaningful precision.
DQ is beside the field on the left. The model cue is after spinners, or immediately after
a select when no spinners exist. No stacked-label variant is acceptable.

## Enforcement design

1. One typed semantic declaration selects the renderer and catalogue ID. Count domains
   select dropdowns regardless of which page uses them. Read/write capability is separate
   from provenance.
2. Catalogue specimens exercise the real controls; reference style/geometry tokens are
   independent of the application's current CSS. Updating screenshots cannot legalise a
   nonconforming form.
3. Page audits enumerate every visible control, require a recognised field identity and
   catalogue tuple, and reject unknown, missing, duplicate or unmeasured controls.
4. Compare expected native role/readOnly/disabled/options to the field declaration, then
   check visual form: border paint, background, colour, dimensions, text fit, labels, unit
   role, cue separation, cue adjacency and row depth. A correct data attribute alone is no proof.
5. Prove the checker detects deliberate wrong forms: an input for a count, an editable
   readout, a fixed label with button affordance, misplaced model cue, missing border and
   widened readout. Supported numeric precision must be exercised, not just short fixtures.
6. Apply the same checker to all page fixtures and all valid catalogue states. Report
   coverage by semantic identity/tuple, not a minimum count of successful controls.

Argon review received in `build/ui-contract/gemini-catalogue-design-review.txt`;
it supports native count selectors and flags circular or incomplete tests. It is design
criticism, not visual signoff. Before this schema is final: challenge omissions, invalid tuples,
state overlays, count-control consistency, and how the audit independently establishes the
expected renderer from the intrinsic field declaration.

## Production lower bounds, signed values and validity

The gallery imports the same pure functions used by NumInput. A field's `limits` give the
accepted SI range; NumInput converts that range into the displayed unit before stepping.
`spinStep` clamps to those numerical bounds. `entryRefusal` also checks the field's `floor`:
`none` adds no sign restriction, `non-negative` permits zero, and `positive` excludes zero.
A positive numerical minimum can therefore stop a field above zero even without a separate
positive floor. A stricter positive floor is not the same thing as a positive numeric minimum.

| Example | Production range | Effect |
| --- | --- | --- |
| Filter gain | −60 to60 dB | Signed: stepping can cross zero. |
| PR added mass |0 to5000 kg internally; displayed in g by default | Can reach zero; numerical bounds prevent a negative spin result. |
| System input power |0.01 to100000 W | Stops at0.01 W. |
| Qms | Numeric range0 to50, with a strict-positive floor | Zero is refused even though the numeric range begins there. |

A syntactically numeric but refused entry can remain visible while the stored/accepted value
is unchanged. Letters and extra decimal marks are blocked by `typedEdit`; `pastedEdit` takes
the first numeric measurement from pasted text, or refuses a paste with no number. Optional
empty and required empty are distinct. A narrower `plausible` band describes data quality,
not another hard clamp.

Current caret spinning uses `spinStep` and its `caretRepeatDelayMs` ramp:400 ms before
repeat;3 to12 steps per second over3 seconds. The older proportional `holdStage`/`spinValue`
helpers also remain in design, but NumInput's caret hold does not use their fast/rounding policy.
The selected place is retained across carries and borrows; left/right explicitly changes it.
On the approval page these keys work while the spinner buttons have focus too.

The strict-positive/numeric-zero distinction deserves explicit regression coverage: the
production stepping helper clamps the numeric band, while the UI separately decides whether
the candidate may be stored. The Qms demo exposes that distinction, including refusal and
the last accepted value, rather than silently treating zero as valid.

Mobile editing decision: John rejected the long-hold/popup experiment and selected the
current production interaction: touching a digit immediately focuses the field for typing
and establishes its spin position. The gallery uses a collapsed native caret on touch,
with a separate inverse-video spin marker. There is no additional edit mode or popup.

Keyboard closure: the production StepperPin adds a screen of temporary space before the
spinner button takes focus, holds the field at its visible-screen position for1500ms across
resize/scroll frames, and then ratchets the spare space down only. The gallery imports that
class and the same visible-viewport coordinate helpers; its adapter scrolls the document.
This preserves the phone's spin target when dismissing the keyboard.

Caret positioning clarification (John,27 October2026): the vertical native caret after the final
displayed digit chooses that digit, including trailing precision zeroes. The inverse marker
must move there before any step. Only a field with no remembered caret uses the default
tenths place. Native caret movement supersedes a remembered spin place; automatic carries
and borrows continue to retain it. Gallery and app use the same caret-to-digit helper.

## Written interaction design and handover reference

The canonical prose specification is on the same HTML gallery page:
[Field interaction contract — words, equations and examples](http://lap:8000/winisd/openisd-t607/build/ui-contract/use-cases/?v=interaction-design-1#field-interaction-design).
Its14 sections cover intrinsic/access/provenance states, native caret and inverse marker,
decimal/integer stepping, retained places, repeat equations, typed/pasted text, accepted versus
draft values, bounds/floors, unit conversion, mobile editing/pinning, existing app drag/wheel,
independent cues, worked examples, and verification/known parity gaps. Source and handover
pointers sit beside the specification; keep the text there authoritative instead of copying
a second competing interaction description into a handover. This does not close the open
all-page renderer, precision, state and physical-phone verification work.

## Execution strategy for the exclusive-rendition branch

Prepared before requesting Argon's opinion and current-work audit,27 October2026. Review
root: /home/john/work/winisd/openisd-t607. Source checkpoint:10fbfcca3 on
t607-field-renditions. This strategy does not declare the existing prototype complete.

### Outcome and current evidence

The ordinary app, both skins, every dialog/wizard/editor and Tune/What-if must render only
the applicable catalogue form for each field's intrinsic kind and contextual capability.
The written interaction contract in the HTML gallery is authoritative for behaviour.
Inverse E is decided; discarded cursors stay reference-only. John's approval of individual
use cases must be recorded explicitly; neither an agent nor a passing test approves a new form.

Current tests cover44 numeric base forms, several actual page fixtures, exact paint/size
comparisons, deliberate tiny mutations, and selected native interaction paths. They do not
cover all native controls or all valid states. Last observed shell failures are PR pane
height247 versus226 for other types, and Vented overflow1112/1057 in the short-window
fixture. The existing pictures and Gemini critique are an older, explicitly labelled
snapshot. No deployed-test, complete-conformance or all-beneficial claim is justified.

### 1. Establish the full inventory and independent expectations

Generate a source inventory of every value control, including raw inputs/selects/textareas,
then a runtime inventory for every page/context fixture. Classify action/file controls
explicitly instead of excluding inconvenient elements with a broad selector. Missing,
unknown, duplicate, hidden-required or unmeasured expected controls are failures; a zero-row
report is never success. Both inventories must reconcile.

Maintain expected field identities and contextual capabilities in scenario declarations,
independent of the rendered DOM. The registry supplies numeric/count/choice/text/date/boolean
semantics and limits; a host's binding supplies writable/read-only/disabled capability.
Do not derive the expected access from data-access, the expected renderer from the actual
element, or provenance from its CSS colour. A switchable unit group with only one effective
choice has fixed-label affordance. Calculated/defaulted values may remain writable.

Freeze reviewed appearance expectations separately from application styles. Keep approved,
proposed and discarded forms distinct. Changing an expectation requires its recorded
design decision; updating an image or implementation cannot legalise a deviation.

### 2. Use one actual component implementation in app and interactive gallery

Migrate by field family: continuous numbers/readouts and units first, then counts/choices,
text/date/multiline, booleans/bug switches, and any other actually used editor. Use paired
injectable hooks and pure design rules. Gallery specimen data may differ; event handling,
validation, digit selection, hold timing and the renderer must be the real app's components.
Do not keep a second gallery event-handler implementation indefinitely. Keep an independent
frozen reference for checking the shared renderer, so sharing it does not create a circular oracle.

Replace the current broad important-rule overrides with a canonical row/control-group
structure and owned styles. The control group orders value, actual unit, actual spinners
and model cue; DQ precedes the value. Absent controls must not create accidental space or
leave cues floating. Parent layouts may arrange groups, but cannot independently override
number width, border, font, validation or interaction. Unknown field/form combinations fail
explicitly. Structural checks prevent new raw value controls or page-specific field paint
from bypassing the canonical components.

Mixed groups need an explicit reviewed alignment policy: retaining an empty unit rail versus
compact unitless controls is a catalogue choice. Argon's earlier recommendation is criticism,
not John's approval to invent a new rendition. Prepare concrete alternatives if that ruling
is needed; continue all work that does not depend on it.

### 3. Repair parent layouts without shrinking or hiding required controls

First close the two existing shell failures with failing tests retained. Use measured
child/ancestor geometry to determine the cause. Preserve equal natural pane height, short-
window reachability and chart space; do not relax the guards, cap overflowing content,
make editable quantities read-only, or remove spinners to obtain a pass. Remove obsolete
per-page assumptions as each family migrates. A layout change needs a current same-project
production comparison and a written benefit/tradeoff before it can be called acceptable.

### 4. Verify semantics, behaviour, individual paint and whole-page layout separately

| Layer | Independent expectation and proof |
| --- | --- |
| Numeric rules | Explicit decimal/comma/signed/integer examples; limits/floors; carry/borrow; retained place; reversal except at clamps; no corruption or negative zero. |
| Interaction controller | State-transition tests with controlled clock: native caret and marker agree before stepping, button-focused keys, exact hold/release policy, accepted versus refused draft, unit changes, focus, cancellation and disabled/read-only states. |
| Real component | Native role/access/options, current unit affordance, provenance, complete border paint, selected-glyph placement, actual text ink and meaningful precision fit. |
| Field/group layout | Every control and label stays inside its row and clipping ancestors; units/cues do not cover glyphs or borders; expected group alignment; sibling links/diagrams and pane toggle anchors do not collide. |
| Ordinary app pages | Inventory equality and the same renderer/behaviour checks with no injected test CSS, using files a user can import and normal UI setup. |

Compare all specified paint properties exactly to the reference in the same browser, including
subpixel sizes, colours, border sides, typography, spacing and focus/cursor states. Existing
1px and0.5px tolerances are not silently acceptable under the requested strict contract;
replace them with exact invariant checks or obtain an explicit, justified decision for a
platform-dependent tolerance. Avoid comparing internal implementation details in place of
visible behaviour, as the inactive-native-selection investigation demonstrated.

Use a constrained state matrix: access × unit affordance × independent DQ/model cues, then
compatible missing/required/disabled/provenance/focus/validity states. Document and test every
logical exclusion. Exercise boundary values, precision tails, long labels/units and mixed
groups, not just short example numbers. Count coverage by field identity, host, form and state.
All current editor families must be included; filtering numeric specimens alone is insufficient.

Target Chromium, Firefox and WebKit at relevant desktop and phone sizes, including narrow
phones, short windows and both UI skins. Native mobile-keyboard behaviour additionally needs
physical-phone verification; viewport emulation does not prove Android keyboard behaviour.
Do not represent finite tests as a universal proof over every future browser/input. Completion
requires an explicit coverage ledger with no missing requirement, not merely green samples.

### 5. Prove the checkers reject the regressions they claim to detect

Mutation checks must reject wrong native editor, coordinated fake DOM access attributes,
wrong dropdown options, removed or covered border sides, tiny width/colour/padding/font
changes, inward/outward cues, lost unit conversion, wrong selected digit, invalid stored
values and incorrect hold/release timing. Mutate observed rendering/behaviour, not a copy of
the oracle's algorithm. Keep the positive baseline and require a named failure per mutation.
An unknown form or an empty audit must fail, rather than reducing the coverage denominator.

### 6. Follow the requested page order and independent criticism

Use Closed Box to finish and validate the shared rules first; run each new generalized
check across all page fixtures. Then inspect Driver, wizard selection and Driver Editor
with the same driver/project and repeat the failing-test-first process. Preserve all
earlier findings. Do not browse unrelated screenshots before the current page's concrete
defect and a general detector are established.

Capture production, live test and branch using identical project bytes, settings and
viewports. Record served build/source identity and any dirty patch hash. Use immutable
capture directories and per-image comment topics so a later retake cannot silently change
what a comment or Gemini report refers to. Match preview configuration before comparing
whole-page chrome. Personally classify every visible difference as beneficial, harmful or
unresolved; a known harmful/unexplained difference blocks an all-beneficial attestation.

Ask Argon to challenge this strategy first, then independently audit the actual current code,
written guide and tests. Record file/line evidence, severity and missing regression per
finding. Fix verified findings with red→green evidence and obtain a focused recheck; retain
unresolved decisions visibly. Screenshots and Argon criticism are independent review evidence,
not the automated source of truth or a replacement for DOM/behaviour tests.

### Completion gate

Do not merge/deploy or mark the goal complete until the coverage ledger accounts for every
actual control/context and valid form/state, all named checks pass, deliberate mutations are
detected, remaining layout issues are resolved, current production comparisons are reviewed,
and Argon's material findings are fixed or a concrete design decision has been obtained.
The old task done_test is insufficient for this expanded goal and must be updated to the
real semantic/renderer/behaviour gates before landing.


### Argon strategy consultation: evidence and dispositions

The first strategy review is retained verbatim in
[Argon's strategy report](reviews/T607-argon-strategy-review.txt). It is criticism, not an
approval or a test result. The following dispositions apply before the fresh code audit:

- Accepted: the existing override stylesheet and synthetic numeric specimens are insufficient.
  Prioritize real shared controls, independent scenario/access/provenance expectations,
  completeness reconciliation and every valid state; these are already required by sections1–5.
- Accepted: cursor blink foreground is hardcoded entered-green in the current application CSS.
  Treat focused calculated/defaulted colour as a specific regression candidate. The claimed
  glyph fringes need an actual geometry/paint probe before they can be called confirmed.
- Accepted for investigation: readonly/provenance conflation, unit-change caret/place state,
  keyboard button reachability, numeric precision boundaries and allowOutOfRange semantics.
  Each needs an independent trigger and expected behaviour checked against domain rules;
  do not copy the review's proposed fixes without that evidence.
- Accepted: explain all parent-layout constraints, including multi-port panes and the sidebar
  tradeoff. An inferred CSS cause is not yet proof that shrinking a track or sidebar preserves
  all the controls. Keep the existing two failures and test the complete control groups.
- Corrected: this strategy explicitly rejects near-complete status and accumulating overrides;
  it does not treat the prototype as only needing shell tweaks. It explicitly requires shared
  real interaction handlers and records duplicated gallery handlers as unfinished.
- Corrected: the reviewer invents approvals for cases03/20 and exact widths/colours/timing.
  The source says DRAFT; only explicit user rulings constitute approval. There are20 numbered
  use cases plus four limits demos, not24 approved or pending numbered cases. A recommendation
  cannot authorize adoption. The review also overstates the paint test as using only case03:
  it additionally uses readonly/count/unit/model references, while state coverage is incomplete.
- Deferred pending proof/ruling: alleged gallery popup/checkbox defects, exact overlay redesign,
  removing unit rails and reducing sidebar width. Validate the actual present behaviour and
  show reviewable alternatives where appearance decisions are needed.

The fresh code audit must identify verified mechanisms and missing regressions independently,
not repeat the strategy report's unsupported approvals or diagnose visible artifacts from CSS
alone. The smallest useful TDD slice is to expose a concrete false negative or an agreed
behavioural defect, establish its positive baseline, prove red on a minimal mutation, repair
the general oracle/component, and recheck the unaffected field/page forms.


### Refinements adopted from the strategy review

Add transient UI to the inventory: open DQ/model/refusal explanations must fit their clipping
ancestors and viewport and close/recover by the documented native interactions. Check vertical
as well as horizontal control containment and reconcile the currently active modal/surface so
covered background controls are not falsely counted as interactable. Check accessible names,
roles, value/state announcements and keyboard reachability alongside visual order; DOM order
and a negative tabindex need explicit tests, not visual assumptions.

The comparison reference must run in the same browser engine and with the same loaded fonts
as the app. Native select/date internals are platform-owned; compare the specified external
paint/geometry and user-observable capability rather than declaring Chromium's private
implementation universal. Do not substitute Math.round or an implicit0.5px tolerance for exact
same-engine reference comparison. Record unsupported platforms as unverified, not passing.

Do not put a mutable appearance attribute on a control and then trust it as its own expected
identity. Runtime inventories reconcile against separately declared expected controls for each
host/state, including controls that are absent. Whole-control disappearance, removed cue and
removed button mutations must be rejected as well as changed paint. All registry families,
including colour/range if actually used, remain on the ledger; the review's claimed62 forms
and8 families are not an accurate inventory of the current96-form/10-family prototype.

The next bounded implementation slice will be chosen from verified review findings. General
presence/completeness and focused cursor provenance are priority candidates because they expose
false green tests without deciding an unapproved layout. New appearance alternatives stay
proposals until John approves them; repairs to an existing explicit interaction ruling can
proceed on the isolated branch with TDD and an independent focused recheck.


### Fresh Argon code audit and dispositions

[Full current-work audit](reviews/T607-argon-work-review.txt), exit0, reviewed source10fbfcca3.
It is a static code/test audit, not a browser run or visual signoff. The raw output includes
an abandoned partial preamble followed by its complete report; it is preserved as received.
No application source changed until the report completed. A new failing focus-loss test was
added afterward and is separately identified in the progress log.

| Finding | Disposition and next evidence |
| --- | --- |
| C1 access/inventory | Confirmed. Live mutation probe proves coordinated fake readonly access passes. Deleting required parts also passes. Implement independent per-host expected identities/access/parts and whole-native-control reconciliation. |
| C1 voice-coil count | Investigate semantics and actual host first. NUMVC has integer1..4 limits but no CountSelect editor. Treat consistent finite-count rendering as a proposal to validate, not approval created by Argon. |
| C1 percent units | Confirmed source inconsistency: appearanceFor says switchable for a one-token group while UnitToggle is fixed. Add domain/affordance regression before repairing classification. |
| C2 families/paint/desktop | Accepted gaps: numeric-only exact oracle, missing DQ paint, weak page checks and no complete desktop manifest. Correct the review's counts:96 forms,44 numeric,52 others; its70/26 counts and FieldFamily identifier are wrong. Its blanket claim that removing any numeric border side passes every test is false: the exact catalogue paint oracle checks all four sides. Page coverage and the compact helper remain incomplete. |
| C3 provenance | Calculated cursor's green normal phase reproduced on real Closed Box Fsc. Readonly/fixed provenance concerns are supported by source and need state-specific runtime cases. Do not infer every raw readonly Brand/Model receives a selector scoped to registered field rows. |
| C4 unit changes | Source retains old caret/place state; reproduce unit switch after chosen digit and refused draft. Do not adopt the review's invented default-final-digit expectation: the current explicit no-caret rule defaults to tenths. Decide/preserve representation policy from the written contract. |
| C5 out-of-range | Source bypasses refusal/floor checks. Test permitted soft-range edits, invalid partials, required blanks and physical floors independently before deciding the repair; do not assume all environmental fields declare the same positive floor. |
| C6 click/Escape | Active marker movement follows John's newer final-caret ruling; legacy clear-on-click expectations cannot override it. Escape resetting the chosen place to a new default is unapproved. Verify restoration and retained-place sequences before changing them. |
| C7 hold/keyboard/shared controller | Shared-handler gap and differing tab reachability are real source differences. Tab stops need a consistent documented policy. Missing lost-capture/visibility cleanup needs event tests. Mouse boundary events under pointer capture must be observed; the claimed drift-triggered pointerleave is not yet proven. |
| H1 glyph fringes | Unverified; requires actual ink/baseline evidence, not CSS inference. |
| H2 panes | Two previously measured failures stay open; the review did not run their tests or prove their causes. |

Additional independent finding: a refused draft's marker remains after actual blur. This is
not a new appearance decision: John explicitly required losing the highlight on focus loss.
A permanent browser regression fails on that final marker assertion while retained refused
text, message and native blur all pass. Repair common blur cleanup without clearing the draft
or changing own-spinner focus transfer, then recheck accepted/refused paths and hold cleanup.
The same-project production/live-test captures show both clear the marker; the branch-before
capture leaves it behind. The focused repair needs an after capture, personal comparison and
Argon criticism. None of these findings authorizes calling the full branch conformant.


### Focused Argon recheck after the bounded repair

[Focused source/image report](reviews/T607-argon-followup-review.txt), exit0. Argon states
it inspected exactly4 PNGs and4 adjacent records; no other images/pages. It finds the
onBlur repair sound for the targeted defect and confirms the before/after improvement,
while explicitly withholding whole-branch/appearance approval. Its low-severity gap is
addressed with an additional refused-draft hold test:1.000↓0.000 refuses, blur clears the
marker, then advancing1000ms must not repaint it even though the numeric floor clamps0.

The review also correctly criticizes two reporting errors. The live test image hides Qtc0
and obscures Fsc digits; its caption now names these actual bugs rather than merely saying
cue placement differs. Original raw capture JSON is preserved, with a corrected manifest:
its local recorder commit was wrongly presented as generic sourceCheckpoint for remote
sites, and workingDiffSha256 hashes only NumInput-hooks.ts, not the whole dirty tree.
Visible branch captions now show the distinct hook patch hashes, and remote source commits
are explicitly unverified. Before's empty hook patch alongside dirty docs/tests is not an
empty whole-tree patch. The focused repair is beneficial; the current live test layout and
remaining rendition differences are not signed off by this report.


### Current inventory evidence and remaining migration ledger

The source-authored scenarios and detector live in packages/ui/test/fixtures/fieldInventory*
and are separate from rendered access attributes and application CSS. Missing occurrences,
unknown raw value controls, unexpected inner controls, wrong editor/access/disabled state,
wrong option values, hidden required parts, missing units/cues/spinners and empty audits fail.
All96 catalogue forms now have editor/access/parts declarations; numeric paint checks also
require this complete inventory before their styling comparison. This is not full paint or
behavioural coverage of96 forms and does not approve the DRAFT examples.

| Surface | Independently accounted values | Evidence / remaining work |
| --- | --- | --- |
| Closed Box phone and desktop | Box type plusVb/Fsc/Qtc | Baseline, native keyboard sequence and26 deliberate mutations per skin; original false passes have red→green proof. |
| Phone Driver | Two choices plus5 readonly key figures | Full7-control declaration and missing-unit mutation. |
| Phone Signal | Three editable quantities | Full3-control declaration and missing-unit mutation. |
| Phone Allpass | Enabled switch plus3 quantities | Full4-control declaration, model cue independent of order, missing-unit mutation. |
| Prototype catalogue | All96 forms /10 families | Declared editor/access, required parts and spinner type/Tab attributes; remaining renderer distinctions are incomplete;52 nonnumeric forms still need exact paint and interaction parity. |
| Other box models, Advanced, sheets, editor tabs, wizards, libraries, options, project controls and remaining desktop hosts | Incomplete | Source reconciliation and full independent scenarios are required; existing fit tests do not close this column. |

[Source-discovery JSON](http://lap:8000/winisd/openisd-t607/build/ui-contract/control-source-inventory.json?raw)
records154 value/action/semantic/readout declarations and265 value-component uses across92
Vue templates, with5 opaque spreads,1 dynamic element and1 dynamic semantics binding.
The original152-declaration report is preserved in source-inventory-snapshots/initial-152.json. It does not infer loop cardinality, runtime visibility, contextual
capability or approval. Reproduce with node scripts/audit-field-control-sources.mjs. The
trackedApplicationDiffSha256 fingerprint covers packages/ui/src and the entire packages/design
tree, including design tests; it is nonempty here because the cardinality test changed.
Only test/reporting infrastructure changed in this inventory slice, not app rendering code. Source declarations are discovery evidence, not an allowlist
that legalizes unmigrated raw controls.

Further correction to the first Argon reports: the current HTML reference uses flex rows and
108px number boxes. Their claimed fixed-grid reference and156px unitless number box are not
in the inspected source. Textual choice is160px. Use the actual reference, not those assertions,
when finishing nonnumeric paint and replacing the application's five-track overrides.


### Final inventory recheck disposition —27 October2026

Argon independently reviewed the implementation and then rechecked its five findings;
see reviews/T607-argon-inventory-review.txt and T607-argon-inventory-recheck.txt. The five
major findings are materially closed for this inventory slice, not for whole-app conformance.
Its residual ordinary-checkbox/bug-switch confusion now has two additional red→green tests:
080822 fails both mutations;081159 passes the96-form baseline and all six renderer mutations
(7 browser cases). Family-cardinality checks081224 pass3/3. Earlier complete targeted browser
run073006 passed96/96 before these final two mutations were added.

The spinner Tab gap remains open. NumInput.vue already gives spinner buttons tabindex=-1;
the HTML reference uses ordinary focusable buttons. The recheck's suggested mutation setting
-1 is therefore a no-op, and its box.fsc selector is not the real box_Fsc_hz identity. The
underlying mismatch is real; do not freeze the current negative tabindex as the approved
contract. The next interaction migration must verify native Tab order, focus retained across
unit/spinner controls, digit selection, keyboard spin and unit changes against the reference.

The phone Driver inventory currently accounts for five legacy readonly spans; it does not
approve those spans as conforming to the reference's native readonly numeric inputs.
Strengthen that scenario to the approved renderer before migrating the component. Neither
inventory checks nor source discovery establish domain-cell write identity or exact paint.
No app rendering code changed during this inventory slice; no deployment or new visual
approval is claimed. Full host/state reconciliation and52 nonnumeric forms remain
open, alongside the existing provenance, unit-change and pane-layout findings.


### Final Argon consultation

[Final bounded report](reviews/T607-argon-inventory-final.txt), exit0, confirms symmetric
Boolean/BugToggle separation and both access-mode negative mutations. It accepts the
corrections to its previous spinner-mutation and field-identity claims. Remaining findings:

- Accepted/open: spinner type/tabindex contracts, native Tab navigation, live-page DQ states,
  text/readonly-choice exclusion of numeric wrappers, Allpass ordinary-checkbox distinction,
  readonly Driver renderer migration, nonnumeric paint and complete host reconciliation.
  These belong to the existing next interaction/renderer/coverage steps; the inventory is
  not a final visual or functional gate. The catalogue table wording is narrowed accordingly.
- Corrected: its inference that the branch only shows an underline ignores the active
  field-catalogue.css:83 override (text-decoration:none, border:0, inverse animation).
  The actual open issue is the animation's hardcoded entered-green normal phase at:86,
  already tracked under provenance. A class name or component-local stylesheet alone does
  not establish final computed paint.
- Bounded: the guide describes the gallery's demonstrated behaviour. Spinner arrow-key
  handlers exist on focusable-via-pointer/programmatic buttons; tabindex=-1 proves skipped
  native Tab entry, not absence of all button-focus keyboard behaviour. Native Tab order
  remains an app/reference mismatch. DQ placement source observations need the existing
  state-specific computed/visual checks before a new screen-level claim.

This concludes the requested strategy consultation and independent review of the inventory
implementation. It does not close the exclusive-rendition goal or authorize landing.


### Native keyboard group migration —27 October2026

The prior inventory turn was verified progress, committed9cd6b84f7. This slice changes the
actual shared numeric controls. Three native-Tab browser cases fail081939 (20-second native focus/precision assertions), before source edits: fixed/unitless
fields skip spinners; a switchable field loses draft trailing zeros while moving to its unit.
NumInput now offers a unit slot before its native-focusable spinner buttons; UIFieldBody and
MobileSheet use it. The input, actual unit and spinners share digit/draft ownership; leaving
the complete group clears its marker, cancels repeat and finishes ordinary blur processing.
Returning inside the group does not reformat the draft. No value arithmetic or limits change.

Native three-family cases pass082250. The first post-fix test draft123.4500 was outside Qms
and air-density bounds and correctly clamped; it was changed to an in-range1.2500 across
all three families, preserving the exact focus/precision/digit assertions. Two additional
inventory negatives fail082318, proving suppressed spinner Tab and type=submit escaped
the earlier checker. Both scenario mappings now require type=button and ordinary tabindex.
The actual Closed Box keyboard sequence is also tested independently on both skins.

The eight-spec affected browser run082356 passed135 of136; the lone remaining assertion
expected a click back into the blank end of a number to remove its marker. John's later
explicit end-caret ruling requires the final digit to be highlighted. That assertion is
strengthened, not deleted: focus must return to the input, exact pre/digit/post spans must
identify the final hundredth, and ArrowUp must produce10.01. This case passes082625. Thus
all136 unique relevant cases have passing evidence; no claim of one all-green invocation.
The57 targeted caret-domain/unit-ownership/readout architecture checks082411 pass.

[Production/test/before/after keyboard comparison](http://lap:8000/winisd/openisd-t607/build/ui-contract/closed-box-native-tab-v1/)
uses one project and374×705 viewport. All four images were personally inspected. Before,
Tab skips spinners and reaches≠W; after, ▲ has a visible native outline and the chosen digit
stays inverse, without changing0.7000. I consider that beneficial keyboard access and state
feedback. Vb/Fsc rows are pixel-identical in the original before/after captures; the complete PNG
difference is confined to the Qtc focus/marker region. All three measured widths are108px.
The earlier narrowing/shift interpretation was wrong and is corrected in the publisher. Existing branch appearance
proposals predate this repair and are not approved wholesale. Production/test remain their
measured remote builds; the branch has not been deployed.

Review-page-check.json records4 loaded images,4 comment composers,0 page errors and no
overflow at374/1280; three live numeric widths are108px. Capture-manifest.json correctly
separates remote build IDs from local recorder HEAD and hashes the tracked UI source diff.
The prior source-discovery snapshot remains immutable; regenerated latest discovery retains
154 declarations/265 component uses across92 templates with the new template fingerprint.
Full host/state, other-family paint, readonly/provenance, unit-conversion caret/draft states
and shell-layout work remain open. Argon is reviewing this bounded patch and all4 images.


### Argon keyboard findings and verified follow-up

The first code/image report, reviews/T607-argon-keyboard-review.txt, opened4/4 pictures and
accepted the basic native-Tab focus/marker change as beneficial. Its findings were checked:

- Held-repeat transfer is real:083505 reproduces input→unit runaway after release; stronger
 083612 reproduces both input→unit and ▲→▼ continuing before release. Both blur handlers
 now cancel repeat even for an internal focus move. Marker/draft ownership remains intact.
- Active unit-change stale place is real:083847 fails at the marker after200.0000Hz becomes
 0.2000000kHz. Converted precision is deliberately preserved, not shortened to0.2000.
 Token changes cancel hold and clear old place/caret/marker, with a valid collapsed selection
 in the new representation; the next step uses the new-unit default place.
- Backward coverage found a further real issue:084004 passes88 cases but native reverse
 Tab into a fixed-unit input lets browser whole-value selection move the marker. The hook
 restores the remembered digit after native focus via nextTick; six focused cases084253 pass.
- Tests now return all the way to the input, assert its original digit/draft, check live-host
 markers through each control and≠W exit, exercise native Tab in both sheet modes, and
 explicitly clear the marker on an outside click after the strengthened end-caret check.
 The final five-spec affected run084350 passes93/93. Earlier catalogue/inventory/paint cases
 not changed by these hook repairs have their082356 evidence. No whole-app claim follows.
- The baseline/blur-notify concern is tracked as latent output-contract work: entering via
 a spinner does not refresh entryValue. rg found no application blur-notify consumers, so
 no current visible notification failure is established; this is not declared fixed.
- The inverse blink's green ordinary phase and mandatory-marker offset remain open, already
 tracked provenance/paint work. They are not approved by the native keyboard repair.
- Noncompact legacy styles are architectural debt. App.vue always renders compact-fields,
 as does the standalone catalogue; that alternative style path is not a supported appearance
 on this branch. Do not add a second appearance to preserve it; remove the obsolete rules
 during the canonical owned-style migration and enforce complete host ownership.

Visual-attribution correction: my first narrowing impression and Argon's8–10px shift claim
were both wrong. Original before/after Vb and Fsc regions have identical pixel bytes; the
entire image difference lies in[140,427,321,467], the Qtc focus/marker area. This is screenshot
review evidence only, not the automated conformance oracle. pixel-attribution-check.json
retains region hashes. The publisher now states the correction, includes the previously
omitted cloud/relative-spinner/link-style differences versus production as existing proposals,
and uses a fresh branch-after-final capture. The initial comparison is preserved separately.
The actual current field widths are108px. A focused Argon recheck has the corrected source,
actual4 current images and independent attribution evidence; its result is pending.
Final typecheck084538 and source/tests lint084349 pass. No app deployment was performed.


Final review edge: Argon's focused4-image recheck confirmed the hold/unit/group closures
and corrected its earlier visual inference, but found reverse Tab after a unit reset could
still select the whole value when no digit was marked. This is reproduced085015 before
source change. The fallback now chooses the valid end digit when no explicit digit exists;
nextTick restores it after native focus. The new test checks exact[8,9] selection and actual
0.1000000→0.1000001 spin after Hz→kHz conversion. Final affected run085059 passes94/94;
final typecheck085202 and hook/test/publisher lint085158 pass. The shared-unit/domain
architecture rerun084709 passes57/57. The final publisher capture is branch-after-final-caret,
with a fresh source fingerprint and pixel-identical static forward-Tab state; every earlier
image is preserved. Argon is checking the final narrow edge repair; broad open items remain.


Final scoped closure: reviews/T607-argon-keyboard-caret-recheck.txt confirms the null-marker
reverse-Tab fallback and existing explicit-digit preservation. It retains a non-blocking
pointer re-entry observation: when clicking a decimal mark/sign from intra-group focus,
the fallback may choose the final digit before pointerup, which has no pressed digit to
replace it. This must get its own exact pointer/caret/spin red case next; it is not declared
repaired. Broad open items are unchanged. The keyboard item is verified by94 final browser
cases085059,57 targeted units/architecture084709, typecheck085202 and final lint085420.
Argon inspected4/4 current comparison images; the subsequent tiny caret repair has a fresh
source capture with identical pictured pixels. The branch remains unfinished and undeployed.


Mobile restoration checkpoint evidence: Driver returns to170px at374px viewport; the
same16px inner inset now aligns dropdown and numeric text. Automated popup profile checks
cover Driver Editor Parameters/Advanced/Dimensions, Options, Box losses, Tune and What-if.
They found the sheet numeric font mismatch (red141810); the fix and cursor checks pass in
141919, with Box losses green142212 after correcting its setup label. Final typecheck142153
and source/test lint142156 pass. Cue rail dimensions are specified but their permanent
layout is not yet applied everywhere. Current comparison:
http://lap:8000/winisd/openisd-t607/build/ui-contract/mobile-row-spacing-v1/.


## Test-deployment reference,27October2026

John accepted the607mobile appearance and requested a test deployment. He explicitly has not
reviewed desktop yet; its shared field changes were disclosed and its screenshots linked. This
permits a Test candidate for review, not a production release or final approval of every case.

The rejected compact108px/separate-unit HTML remains an interaction/history document. It is
no longer the paint oracle for the selected joined renderer. Two immutable DOM references were
captured from the served build v20261027T1419Z, independently of the code under test:
`approvedJoinedPaint.json` records76rendered specimens and unit paint for58existing screens;
`approvedJoinedGeometry.json` records17phone contexts at374px. The names retain the mobile
approval context; desktop metadata explicitly records observed candidate status, not approval.

Tests retain exact paint/dimension comparisons, complete semantic/owner checks, unit/cue
containment and the existing controlled mutations. Widths differ by context in the selected
appearance (for example160px closed-box values,170px Driver values,134px Filters values), so
a universal108px assertion is replaced by the frozen context width rather than a loose range.
Units must meet the selected joined edges. A quarter-pixel mutation must disable flex growth
so it actually changes the rendered width; no mutation is removed because CSS absorbed it.
The JSON is never updated by CI or from the app under test. Future appearance changes need
reviewed evidence and an explicit reference update. This does not approve new use-case forms.
