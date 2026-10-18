# Review: UI-visible changes since 7.0.951 (18 Oct 2026)

Range: `git log --no-merges 539cab244..origin/main -- packages/ui/src packages/design/src` = 71 commits (main at 1df51234).
Sources: task files, `questions.yml`, `questions-archived.yml`, `bugs/`, session transcripts (`~/.claude/handover/history/`, John's own turns only), UI gallery run `ui-gallery/20261018T173053Z_0753831c` and its review `zoo/results/openisd-ui-visual-review-r4.md`.
Rule used: John's words count only when quoted as his. "(John, date)" in a task goal with no quote = agent paraphrase.

## Counts

| What | Count |
|---|---|
| Commits reviewed | 71 |
| Visible to a user | 59 |
| AGENT-origin (or agent overreach of a ruling) layout/style changes | 15 |
| REVERT recommendations | 4 (T197 on tabs, T224, T361, T222/T365 ▲▼ on phone dialogs) |
| ASK JOHN | 5 (T206, T239, T309 greyed Favorites, T365 look, driver editor ▲▼) |

## John's words that bear on layout (verbatim)

| When | Words | Where |
|---|---|---|
| 16 Oct | "focus should stay on the clicked" (▲▼) | BUG_20261016_mobile-vent-stepper… |
| 16 Oct | "I can type letters into" a number field | BUG_20261016_number-fields-accept-letters |
| 16 Oct | Box tab "the bug is that f v q should be interdependent" | BUG_20261016_box-tab-tuning-input-missing… |
| 17 Oct 13:37 | "tune needs a reset button too" | fable transcript |
| 17 Oct 16:26 | "check the field wirthd and height , elignmentd and button sizes, -- this looks like you are going off posts again / are we consistently using the numeric control we created?" | fable transcript (re wizard step 4) |
| 17 Oct 16:28 | "the buttons are tiny on desktop and completely inconsistent" | fable transcript |
| 17 Oct 16:30 | "ensure the correct standard control is used in 100pc of the places" | fable transcript |
| 17 Oct 17:17 | "win isd has c and roo, these must be C or E values in openisd" | fable transcript |
| 17 Oct 17:19 | "who decided to make c roo ReadonlyField" | fable transcript |
| 17 Oct | Phone sheets: "buttons too small to be practical" | BUG_20261017_phone-sheet-controls-too-small |
| 17 Oct | "tune is actually changing the project" | BUG_20261017_phone-tune-and-what-if-share-one-sheet |
| 17 Oct | "empty wizard driver list with no hint"; "the favourite button is selected visible" | BUG_20261017_driver-list-empty-with-no-hint |
| 17 Oct | QD4 underlines: "bring back everywhere" | questions.yml QD4 |
| 15 Oct | What-if rows "not too compressed, just enough" | STATUS_20261014.md (board, quoted) |

No verbatim John quote found for: T197 "shallower rows on every mobile tab", T224, T227, T239, T240, T303, T309 "Favorites disabled", T311, T361.

## Commit table (landing order)

Origin key: JOHN = he asked for this thing. RULING = follows a John ruling, screen detail chosen by an agent. AGENT = no John request found.

| Task | What changed on screen | Visible? | Origin | Kind | Layout risk | Rec. |
|---|---|---|---|---|---|---|
| T183 | Nothing (telemetry fields) | no: telemetry | AGENT | — | no | KEEP |
| T192 | Number boxes step with arrow keys / wheel at the caret | yes | RULING (step rule) | feature | no: behaviour only | KEEP |
| T195 | Phone ▲▼ keep focus, hold-repeat | yes | JOHN (bug, "focus should stay on the clicked") | fix | no: behaviour | KEEP |
| T194 | Version number 7.0.951 in About and footer | yes | RULING (release naming) | feature | no: text only | KEEP |
| T197 | Every phone tab: rows 48→40 px, padding 10→2 px, box 32→30 px | yes | RULING paraphrase only; applied to all tabs by agent | layout | **yes: all phone rows shallower** | **REVERT on Box/Driver/Signal/Advanced/Filters tabs**; keep for sheet |
| T199 | Phone What-if sheet rows one line, sheet sized to rows | yes | JOHN ("not too compressed, just enough") | layout | yes: sheet only | KEEP |
| T202 | What-if: Port area replaces Port diameter; tap opens port fields | yes | RULING (15 Oct; intra row kept 16 Oct) | feature | yes: new sheet rows | KEEP |
| T203 | Box type names spelt out in chart/import messages | yes | AGENT | fix | no | KEEP |
| T206 | Startup storage banner; Your data shows usage | yes | RULING (plan "John GO 16 Oct") | feature | **yes: banner pushes page down, 5 lines on phone** | ASK JOHN (banner size/placement) |
| T204 | Open project list merges saved + open, marks, sort, footer | yes | JOHN (one projects list) | feature | yes: new list | KEEP |
| T207 | Nothing (test build storage) | no: internal | AGENT | — | no | KEEP |
| T209 | Nothing yet (sheet field model) | no: internal | JOHN (tune sheet) | — | no | KEEP |
| T220 | Nothing (fix tests) | no: tests | AGENT | — | no | KEEP |
| T218 | Nothing (sheet session) | no: internal | JOHN (tune sheet) | — | no | KEEP |
| T225 | Nothing (red-main fix) | no: tests | AGENT | — | no | KEEP |
| T224 | Desktop Driver tab Model box 420 px wide | yes | AGENT | layout | **yes: Model huge beside narrow Brand** | **REVERT** |
| T226 | Closing last project no longer crashes | yes | JOHN (bug, his ruling) | fix | no | KEEP |
| T227 | Driver filter row wraps between Fs/Sd/Z groups, not inside | yes | AGENT | fix | yes: small, gallery says fixed | KEEP |
| T228 | Menu works with no project open | yes | JOHN (bug, 16 Oct ruling) | fix | no | KEEP |
| T223 | Phone Tune/Learn sheet UI | yes | JOHN (tune sheet, GO 15 Oct) | feature | yes: sheet only | KEEP |
| T211 | Cleared volume/Q refills; empty filter box red | yes | JOHN (clear rule) | fix | no | KEEP |
| T216 | Phone full-screen Projects pane | yes | JOHN (projects list) | feature | yes: new pane | KEEP |
| T231 | What-if renamed Learn (undone by T336) | yes | JOHN (15 Oct, later reversed) | text | no | KEEP (superseded) |
| T229 | Nothing (crash context) | no: telemetry | AGENT | — | no | KEEP |
| T217 | Desktop: Projects panel top-left with row menus | yes | JOHN (projects list) | feature | yes: left panel redrawn | KEEP |
| T241 | Projects panel refreshes after import/restore | yes | AGENT | fix | no | KEEP |
| T222 | ▲▼ on every desktop number box (incl. driver editor), stepped digit marked; default ▲▼ shrunk 64×32 → 14×20 px, 9 px glyph | yes | JOHN for the arrows (16 Oct ruling); sizes AGENT | feature | **yes: tiny ▲▼, rows wider** | KEEP arrows on desktop; **REVERT ▲▼ on phone dialogs** (see driver editor) |
| T242 | Field value column 90→120 px; driver editor 850→950 px wide | yes | AGENT (fallout of T222) | layout | yes: wider rows/dialog | KEEP (tangled with T222/T365) |
| T243 | New build reaches open app; update prompt | yes | JOHN (bug, his phone) | fix | no | KEEP |
| T246 | About shows only running build + Force refresh | yes | RULING (16 Oct handover, no quote) | feature | yes: About shorter | KEEP |
| T239 | Phone Projects sort tabs: short labels, 44 px | yes | AGENT (screenshot run) | layout | **yes: sort strip edge to edge** | ASK JOHN |
| T240 | Phone labels 4 px clear of row border; banner takes layout space | yes | AGENT (patch of T197) | layout | yes: row padding | KEEP (moot if T197 reverted) |
| T255 | Number fields refuse letters | yes | JOHN | fix | no | KEEP |
| T263 | Project tab dates "16 Oct 2026" | yes | JOHN (bug 17 Oct) | fix | no | KEEP |
| T268 | Export all shows popup | yes | JOHN (rule 4) | fix | no | KEEP |
| T285 | Short phone: sheet rows scroll, chart keeps 120 px | yes | RULING (sheet fit) | fix | yes: sheet only | KEEP |
| T290 | Other exports show popup | yes | JOHN (rule 4) | fix | no | KEEP |
| T275 | Clear rule on V, sealed volume, PR; phone PR shows Mms/Cms; plain names in messages | yes | JOHN (clear rule) | fix | no | KEEP |
| T282 | Nothing (test reloads) | no: tests | JOHN (rule 3) | — | no | KEEP |
| T303 | Skin "Automatic" menu choice; ▲▼ behave per skin shown | yes | AGENT (bob's bug; "decide with John" never done) | feature | no: behaviour | KEEP |
| T309 | Driver list "Filters on" pills + Clear filters; Favorites greyed when none | yes | JOHN for showing filters; greyed Favorites AGENT | fix | **yes: Favorites looks disabled** | KEEP pills; ASK JOHN on greyed Favorites |
| T271 | Same-name projects two rows; phone menu lists open projects | yes | JOHN | fix | yes: menu items | KEEP |
| T311 | Chart plot starts lower so title clears top label | yes | AGENT (fable screenshot) | fix | yes: small chart margin | KEEP |
| T314 | Nothing (test hook removed) | no: tests | JOHN (no back door) | — | no | KEEP |
| T327 | Sealed Fsc/Qtc/Vb typeable; bandpass 4 tuning box | yes | JOHN ("f v q should be interdependent") | feature | yes: new rows | KEEP |
| T330 | ≠W icon by sealed Fsc and Qtc | yes | RULING (CLAUDE.md difference icons) | feature | yes: badge placement | KEEP |
| T336 | Phone Tune and What-if separate sheets, two pull-tabs | yes | JOHN ("tune is actually changing the project") | feature | yes: sheet only | KEEP |
| T338 | PR Fp on Box tab; Mms/Cms on desktop PR tab | yes | JOHN (bug files) | feature | yes: new rows | KEEP |
| T346 | Phone sheets: controls ≥44 px, rows ≥48 px | yes | JOHN ("buttons too small to be practical") | fix | yes: sheet only | KEEP |
| T347 | Sealed picker keeps picked Qtc | yes | JOHN (16 Oct) | fix | no | KEEP |
| T348 | Chart text font stack named (Inter, system-ui) | yes (slight) | AGENT | style | yes: chart font fallback | KEEP |
| T351 | Readonly readouts on shared row (units aligned; phone units 2 px lower); driver editor c/ρ on shared readout | yes | RULING ("every number field onto UIField", 16 Oct) | layout | yes: readout widths | KEEP (shared component) |
| T357 | Advanced air fields and port velocity limit on shared rows | yes | RULING (same) | layout | yes: Advanced rows | KEEP (shared component) |
| T349 | Phone Save button, top row | yes | JOHN | feature | yes: 11 px gutter | KEEP (fix gutter) |
| T359 | Yellow switch "Sealed picker volume" | yes | JOHN | feature | no | KEEP |
| T361 | Advanced: Sound velocity and Air density made readonly grey rows | yes | AGENT; **contradicts John** ("who decided to make c roo ReadonlyField") | layout | **yes: units far right on phone** | **REVERT** (make them E/C fields per T375) |
| T362 | Nothing (wizard plan model) | no: internal | RULING (wizard bug) | — | no | KEEP |
| T363 | Wizard: step 4 volume/tuning for every box type on shared rows | yes | RULING (John's wizard bug 16 Oct; design agent) | feature | yes: wizard steps | KEEP |
| T365 | Wizard rows: one label column, 28 px controls, ▲▼ 18×28, footer buttons ≥84×30; phone selects 18 px font; driver editor 976 px | yes | JOHN (16:26 / 16:28 quotes) | layout | **yes: phone selects bigger font, desktop selects shrink, Back/Next uneven** | KEEP intent; fix side effects |
| T367 | Nothing (engine air API) | no: internal | JOHN (air model) | — | no | KEEP |
| T370 | Escape closes phone Box sheets | yes | AGENT | fix | no | KEEP |
| T371 | Chart redraws after font loads | yes (slight) | AGENT | fix | no | KEEP |
| T364 | Vented alignment Volume/Tuning and rear Qtc on shared readout | yes | RULING (UIField) | layout | yes: small | KEEP |
| T373 | Dotted underline on every unit label | yes | JOHN (QD4 "bring back everywhere") | style | yes: underline reads as link | KEEP |
| T374 | Nothing (solver air state) | no: internal | JOHN (air model) | — | no | KEEP |
| T375 | Project holds five air fields, each E or C | yes | JOHN (17 Oct air model) | feature | no | KEEP |
| T383 | Toolbar icons become real buttons (keyboard) | yes (focus ring) | AGENT (a11y bug) | fix | no: same 34×30 | KEEP |
| T379 | Storage notices carry "N projects, X MB of 5 MB used" | yes | JOHN ("yes", "especialy in any warning") | feature | no: text | KEEP |
| T391 | 0 dB / -3 dB colour pickers work | yes | JOHN ("BUG - DISPATCH A FIX") | fix | no | KEEP |
| T390 | TL port model keeps end correction; yellow switch | yes | JOHN | feature | no | KEEP |
| T394 | "Data" chip by every chart title opens table/CSV | yes | JOHN ("SEE THE CHART DATA AS TEXT") | feature | yes: chip by title | KEEP |

## Summary

### 1. AGENT-origin layout/style changes (revert candidates), landing order

| # | Task | Change | Rec. |
|---|---|---|---|
| 1 | T197 | Phone rows shallower on every tab (ruling was the sheet / tuning fit; later ruling "Box tabs may scroll") | REVERT on tabs |
| 2 | T206 | Storage banner across the top, 2 lines desktop, 5 lines phone | ASK JOHN |
| 3 | T224 | Desktop Model box 420 px | REVERT |
| 4 | T227 | Driver filter row groups | KEEP (fix) |
| 5 | T222 (sizes) | ▲▼ default 14×20 px, 9 px glyph; arrows also appear in phone dialogs | REVERT phone part; resize desktop |
| 6 | T242 | Value column 90→120 px; driver editor 850→950 px | KEEP (tangled) |
| 7 | T239 | Phone sort strip edge to edge | ASK JOHN |
| 8 | T240 | Row label padding, banner takes space | KEEP / moot |
| 9 | T309 (greyed) | Favorites greyed when no favourites | ASK JOHN |
| 10 | T311 | Chart plot margin | KEEP (fix) |
| 11 | T348 | Chart font stack | KEEP |
| 12 | T351 | Readouts on shared row, phone units 2 px lower | KEEP (shared) |
| 13 | T357 | Advanced air rows on shared row | KEEP (shared) |
| 14 | T361 | c and ρ readonly grey rows | REVERT |
| 15 | T365 (side effects) | Phone wizard selects 18 px font; desktop selects content-width; Back/Next uneven | fix, ASK JOHN on look |

### 2. Tangled with later work (plain revert hard)

- T197: the same `--mob-row-*` variables drive the sheet (T199, T202, T223, T346) and T240 edited them; needs a split into tab metrics and sheet metrics, not a revert.
- T222 / T242 / T365: the field row widths were rewritten three times (90→120→calc with stepper width); revert means hand-picking the phone-dialog part only.
- T361: T375 then built the five-field air model; the fix is c and ρ as E/C fields, not bringing back the old hand-built readouts.
- T239: sits on T216 and T271 (Projects pane); revert of labels is easy, edge-to-edge strip comes from T216.
- T206: banner text reworded by T378, T379; T240 gave it layout space.
- T224, T309 (greyed Favorites): one CSS rule / one flag each; easy.

### 3. Driver editor dialog and driver list (John: "buttons are tiny and unusable")

There are two layouts, the tabs' field row and the driver editor's own `.de-fld` grid. The tabs use the shared row as designed; the driver editor wraps the shared field in its own label/column rules and its own footer. The phone shows the desktop editor full-screen with desktop-size ▲▼.

Commits touching the editor or list files since 539cab244:

| Task | File | Effect on screen |
|---|---|---|
| T222 | NumInput (shared) | ▲▼ appear on all 30+ editor fields, desktop and phone (7.0.951: none) |
| T242 | DriverEditorModal | dialog 850→950 px to fit the arrows |
| T351 | DriverEditorModal | c and ρ move to the shared readonly readout |
| T365 | DriverEditorModal, NumInput | dialog 976 px; ▲▼ 18×28 px, boxes 28 px tall |
| T373 | UnitToggle (shared) | dotted underline on units |
| T222, T227, T309 | DriverLibrary | filter boxes type text; Fs/Sd/Z groups; "Filters on" pills; Favorites greyed |
| T401 (outside path) | design | same sample file shows Re 1.650 before, 3.300 after (two voice coils): check |

Measured 18 Oct, sample_project_bandpass4.wpr, Driver tab → Edit → Parameters (7.0.951 vs localhost:4000 at main):

| | 7.0.951 | main |
|---|---|---|
| Desktop boxes | 90×21 px, no ▲▼ | 88×28 px + 54 ▲▼ at 18×28 |
| Phone (374 px) boxes | 90×21, no ▲▼ | 88×28 + 54 ▲▼ at 18×28 (touch rule is 44) |
| Footer OK button | desktop 41×31, phone 33×31 | unchanged (not covered by T365 footer rule) |
| Dialog width desktop | 850 px | 976 px |
| Gallery coverage | — | driver editor is not in the UI gallery at all |

Shots (scratchpad): [phone before](file://wsl.localhost/Ubuntu-22.04/tmp/claude-1000/-home-john-work-winisd-openisd/ab51a047-4425-4215-bba1-ec39c0edb3ae/scratchpad/shots/before-phone-c-params.png), [phone after](file://wsl.localhost/Ubuntu-22.04/tmp/claude-1000/-home-john-work-winisd-openisd/ab51a047-4425-4215-bba1-ec39c0edb3ae/scratchpad/shots/after-phone-c-params.png), [desktop after](file://wsl.localhost/Ubuntu-22.04/tmp/claude-1000/-home-john-work-winisd-openisd/ab51a047-4425-4215-bba1-ec39c0edb3ae/scratchpad/shots/after-desktop-c-params.png).

Findings:
- Phone ▲▼ in the editor are 18 px wide: the phone hides ▲▼ only inside `.mobile-root`, and the editor dialog sits outside it. Origin: T222 default-on, never checked on phone.
- John's 6 Oct ruling "`de-fld` (driver editor field) leaves `UIField`" (BUG_20261005_no-common-ui-field-component) is still not done: every editor row is `class="de-fld"` with its own grid.
- Editor footer (OK, Reset, Cancel, Export, Import) is its own `.de-footer`, outside the T365 one-size rule.
- Recommendation: phone editor gets the phone row (44 px ▲▼) or no ▲▼ as in 7.0.951; desktop editor uses the tabs' row and the shared footer size. ASK JOHN which.

### 4. Inconsistencies still on main

- ▲▼ size: desktop shared row 18×28; Options and other bare boxes 14×20; phone tab rows 64×32; phone sheets ≥44; phone driver editor 18×28.
- Footer buttons: T365 size rule covers wizard, Options, What-if, not the driver editor; phone Options OK/Cancel stretched, Defaults narrow.
- Driver editor rows (`.de-fld`) vs tab rows (shared field row): different label placement and widths.
- Options dialog: units drop to a line under the label (desktop); bare number boxes, not the shared row.
- Unit position: beside the box on tabs, far right on phone Advanced (c, ρ), under the label in desktop Options.
- ≠W badge: above the unit on phone, far right on desktop, under the select in the wizard.
- Row depth: phone Box/Driver/Signal 40 px rows, 4 px padding; sheets 48 px; dialogs and menu looser.
- Selects: phone wizard selects 18 px font; Box tab select smaller; desktop wizard selects content-width.
- Air c and ρ: readonly on Advanced, E/C in John's model and in the driver editor.
- Disabled look: greyed Favorites, washed-out Back/Create, three treatments.
- Gutters: phone Save 11 px, banner 10 px, rest 16 px.
- Desktop Driver tab: Model 420 px beside a narrow Brand.
- Dialog headers: grey (Options, Driver database) vs white (Diagnostics, Differences).
- Unit underline: dotted on new screens, plain on older ones (gallery).

### Out of the given path

11 commits change `packages/design/{fields,domain,engine}` (outside `packages/design/src`) and so fall outside the 71: T191, T232, T245, T259, T300, T356, T366, T372, T378, T392, T401, and the `DesktopSizes` sizes used by T365 live there. Of these, T378 (banner text) and T401 (Re of two-coil drivers) are visible.
