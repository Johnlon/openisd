# Mock design notes / open questions

Running tracker for design decisions and open questions raised while building
`mock/`. Distinct from `MOCK_PROMPTS.md` (verbatim prompt log) — this file is
the _answers and decisions_, kept up to date as things get resolved.

## Answered questions

### Can the SPA auto-load a local WDR/WPR file without the user picking it?

No. Browser security sandboxing means a web page can never read an arbitrary
file from disk on its own — there is no path a real app could take around
this. The user must explicitly hand the file over, either via:

- a classic `<input type="file">` picker, or
- drag-and-drop onto the page, or
- the File System Access API (`showOpenFilePicker` — Chromium-only, not in
  Firefox/Safari), which additionally lets the app remember a _handle_ and
  write back to that same file later in the session, still gated on an
  initial user grant.

So: no auto-load, ever. Every "open project/driver" action is a user gesture.

### Can it save to local browser storage?

Yes. `localStorage` (or IndexedDB for anything bigger/structured, like a
whole "My Drivers" library) persists across page reloads and browser
restarts — it is not RAM-volatile. That's the natural home for a "My
Drivers" custom-driver library and for autosave/recovery of the current
in-progress project, without needing a file at all.

### Can it save into "volatile project WPR storage"?

Yes, trivially — that's just the in-memory JS state of the currently open
project. It's volatile in the sense that it's lost on tab close/refresh
unless also persisted (to localStorage as a draft, or exported as a file).

### Can the toolbar Save button write back to the original file on disk?

Only in Chromium via the File System Access API, and only if the file was
originally _opened_ through that same API (giving the app a writable
handle) — not for a plain `<input type=file>` open, which only ever gives
read access to a snapshot. For a cross-browser app, the safe assumption is:
**Save always produces a fresh download** (a "Save As" to the downloads
folder or wherever the browser puts it), never a silent overwrite in place.

### Can the toolbar Save as... button write to file on disk?

Yes, in the same "always a fresh write, never a silent overwrite" sense as
plain Save — every browser can trigger a download (bytes land on disk
somewhere), but only Chromium's File System Access API
(`showSaveFilePicker`) lets the app present an actual native "choose a
location/filename" dialog and get back a handle it can write to again
later in the session. In Firefox/Safari there's no way to force that
picker from JS — the browser's own download settings decide where the
file lands (silently to the Downloads folder, or its own built-in prompt,
per the user's browser preferences); the app can only _suggest_ a filename
via the `download` attribute on the trigering link. So: "Save As" is real
and does write a file, but "as" (the choosing-where part) is a Chromium-only
guarantee, not a cross-browser one.

### Driver Editor Save — does it overwrite the built-in/common driver store?

No — and it shouldn't be able to. Built-in drivers are shipped data, not
user data. The mock's Driver Editor "Save" button tooltip now says it more
plainly: it writes into _this driver's_ entry, framed as the shared driver
library, not the project. The real distinction the app needs is:

- **Customise** (see below) clones a built-in driver into a user-owned "My
  Drivers" entry (localStorage/IndexedDB) — only _that_ can be edited/saved/
  deleted going forward.
- A raw **Save-driver-to-.wdr-file** export is a separate, always-available
  action (any driver, built-in or custom) — a download, not an overwrite.

## Design decision: What-If was mis-scoped, replaced by Select vs Edit

Original plan (tasks #7/#13) was a distinct global "What-If mode" toggle.
Superseded by this realisation: **every field edit before the project is
saved is already a what-if** — there's no meaningful separate mode. What the
app actually needs is two distinct actions on the Driver tab:

- **Select driver** — pick a different driver into the _current project's_
  WPR model. Does not touch the original WDR file or "My Drivers"; purely
  swaps which driver's values the project is currently using. Can be
  re-edited afterwards (see Edit).
- **Edit** — opens the Driver Editor modal and edits the values already
  living in the current project's WPR model in place.

Then a separate **Manage Drivers** entry (top nav) covers the
library-management actions that don't belong on the per-project detail
pane: Customise-to-My-Drivers, Save-as-new, Edit-custom-driver (never
built-ins), Delete-custom-driver, Disable-custom-driver (hide from pickers
without deleting).

The old "drag a field to explore, then Apply/Exit" what-if-mode idea is
dropped as a separate mode. The spinners/color-coding/drag-to-adjust
interaction ideas still apply — just to _Edit_, not to a distinct mode.

## Open question — editor concept rework (Edit vs Tune)

Looked at the real app's `packages/ui/src/components/DriverWhatIfPanel.vue` as
asked. Its shape:

- A **floating overlay**, `position: fixed; right: 24px; bottom: 24px`, ~460px
  wide, rounded panel with shadow — deliberately fixed (not absolute) so it
  escapes the Driver tab's own cramped height budget and always has room,
  and sits over/near the graph without displacing the tab layout.
- Fields: Fs/Qts/Qes/Qms (row), Vas/Sd/Re (row), an "Optional" group
  (Le/Xmax/Pe), then a read-only "Derived" group (Bl/Mms/EBP + a sealed-vs-
  vented suggestion). Label-above-input, unit beside — same pattern this
  mock already uses for the Driver Editor's General tab.
- Footer buttons: **Reset** (back to the library/common model — disabled if
  there isn't one), **Save to My Drivers** (opens an inline name-prompt
  sub-panel in place, does _not_ close the overlay), **Cancel** (revert to
  how the driver was when this session opened, then close), **Done**
  (keep the live edits in the project, close). Exactly the four the user
  specified.

**Decision:** the mock gets both, as two distinct actions next to Brand/
Model on the Driver tab:

- **Edit** — opens the existing Driver Editor modal (already built) for a
  full, non-reactive edit of every field.
- **Tune** — a new small overlay in the same fixed-bottom-right,
  stays-out-of-the-way style as the real app's, with the same four footer
  actions (Reset / Save to My Drivers / Cancel / Done), covering the
  headline T/S fields only (reactive-minimal, not the full parameter set).

Plus **Select Driver** as its own action (separate from both): swaps which
driver populates the current project's WPR model, per the Select-vs-Edit
decision above.

`Manage Drivers` (top nav) still covers the library actions that don't
belong on the per-project pane (Customise, Save-as-new, Edit-custom,
Delete-custom, Disable-custom) — unchanged from the prior decision.

## Open question — Box tab / Vents-PR-bandpass tab merge

Raised, not yet decided: should the Box pane grow a right-hand column (with
a vertical divider) holding the vent/PR/bandpass-specific fields that
currently live on their own nav tab, eliminating that separate tab
entirely? This would also make a single-pane what-if/edit experience
simpler (one place to see chamber vol/tuning _and_ the vent geometry at
once).

**Recommendation:** yes, worth doing — it matches how the real WinISD
groups "Rear chamber" + "Vents" under one Box-adjacent concept already (see
`view_3_ported.png`/`view_2_box.png` notes), and it removes a tab whose
label has to context-switch (Vents/Passive Radiator/Sealed) depending on
enclosure type, which was already the awkward part of the current
implementation. Tradeoff: the combined pane needs enough width for two
columns plus the box illustration, which may push the Box tab layout to
need its own wider treatment rather than reusing the generic two-column
pattern. The Box tab and Vents tab remain separate for now — not yet
actioned.

## Reactive what-if fields: spinners, unit-cycling, ParState color

Applied consistently across Driver/Box/Enclosure/Signal/Advanced tabs, the
Filters tab, and the Tune overlay (not inside one-shot modals — Driver
Editor/Options/Box losses — since there's no live what-if to accelerate
there):

- **Spinners** (`spin-field` class + `initSpinners()` in `script.js`): every
  reactive numeric field gets a pair of up/down buttons wired to
  mousedown-and-hold with a shrinking repeat interval (400ms → down to a
  35ms floor, decaying ×0.82 per tick) — accelerates the longer you hold,
  same idea as the real app's spinners but implemented from scratch since
  native `<input type=number>` steppers don't accelerate. Calculated/readonly
  fields never get one (nothing to spin).
- **Clickable units** (`unit-cyc` class + `data-ug` group + `cycleUnit()`):
  decorative only — cycles the unit _label_ through a fixed set
  (`UNIT_SETS` in `script.js`: length/volume/area/mass/freq/angle/pressure/
  temp/time), never converts the adjacent numeric value, consistent with
  this mock being logic-free. Fields with a genuinely unique/compound unit
  (Ω, Ns/m, H·√Hz, dB, etc.) are left non-clickable rather than forcing a
  fake cycle set onto them.
- **ParState legend**: the Entered/Calculated/Not-available swatch key that
  previously only lived in the Driver Editor modal footer now also sits at
  the top of the main content-panel (all 7 tabs) and inside the Tune panel's
  hint area, since the same green/blue color classes are now applied to
  fields on every tab, not just inside that one modal.

## Manage Drivers / My Drivers

Implemented as an in-memory-only JS array (`myDrivers` in `script.js`) — no
persistence layer, consistent with this being a logic-free static mock; a
real build would back this with `localStorage`/IndexedDB per the "Can it
save to local browser storage?" answer above. Toolbar menu covers:
Customise current driver → My Drivers, Save as new (prompts for a name),
Edit custom driver (opens the Driver Editor with the orange "editing My
Drivers directly" banner — see below), Delete custom driver, Disable custom
driver (struck-through + `(disabled)` suffix, stays in the list rather than
being removed, matching "hide from pickers without deleting"). The Select
Driver modal's My Drivers tab renders this same array as a real picker
table, not just a placeholder hint.

## Driver Editor: explicit in-UI context (project vs My Drivers)

The Driver Editor modal is opened from two very different contexts that
both edit the same-looking form, so a banner (`#driver-editor-context`,
set by `openDriverEditor(mode, name)`) now states which one is live:

- Opened from the Driver tab's **Edit** button (or the toolbar shortcut):
  blue banner — "editing the driver copy embedded in the current project…
  Save additionally writes an independent copy to My Drivers." Edits apply
  live to the project immediately, same as before.
- Opened from **Manage Drivers → Edit custom driver...**: orange banner —
  "editing My Drivers entry '<name>' directly… the current project is
  unaffected unless you re-select it." Requires a My Drivers row to be
  selected first (via Select Driver → My Drivers), else it alerts.

This replaced an earlier attempt that just renamed the button to "Edit
Project" — per feedback, the shorter "Edit" label was better, but it needed
an in-UI (not just tooltip) cue for which thing is being edited, since the
two modes share one modal.

## Multi-project chart trace overlay — generalized

Previously only the second project ("Epique15-ported") had a wired trace,
and only on the Transfer-function-magnitude graph — the SPL graph (the
default view) had no second-project curve at all, and project 1's own
curve wasn't tied to its checkbox. Generalized via `data-project="<id>"` on
each project row and matching `data-trace-for="<id>"` on every trace
polyline in every graph SVG; `refreshProjectTraceVisibility()` shows/hides
by checkbox state uniformly. Added the missing second-project SPL trace
(`#trace-ported-spl`, blue, independent of the Standard/Iso-Barik toggle,
which only ever applies to project 1's own curve). Both projects' checkboxes
now drive real chart visibility instead of only the second one working.

## Driver Editor: three distinct modes, not two

Following the project-vs-My-Drivers banner above, the footer buttons
themselves now also change per mode (`DRIVER_EDITOR_BUTTONS_BY_MODE` in
`script.js`) — the modal is genuinely different depending on how it's
opened, not just relabeled:

- **`project`** (Driver tab's Edit button): Done / Clone... / Select Driver
  / Clear / Cancel. Done keeps the live edits in the project's embedded
  copy; Clone... additionally writes an independent My Drivers entry;
  Select Driver swaps the project to a different driver's values entirely.
- **`mydrivers`** (Manage Drivers → Edit custom driver...): Done / Clone... /
  Clear / Cancel — no Select Driver, since swapping "which driver the
  project uses" doesn't apply while editing a My Drivers entry directly.
- **`toolbar`** (the toolbar's Driver Editor icon): a standalone editor, not
  tied to any project or My Drivers entry. Opens **blank** (`clearDriverEditor()`
  runs on open) until populated via Select Driver or Load driver. Buttons:
  Select Driver (from the database or My Drivers) / Load driver... (from a
  local file — mock: only the filename seeds Brand/Model, contents aren't
  parsed) / Clone (detaches this session from whatever was loaded, so
  further edits aren't tied back to the original — a pure in-session state
  change, doesn't persist anywhere by itself) / Save as to disk (a real
  browser download of a plain-text field dump, filenamed
  `<brand>_<model>.wdr.txt` — deliberately not claiming real WDR binary/XML
  compatibility) / Save to My Drivers (persists to the in-memory My Drivers
  array) / Create Box... (spins up a new project row prefilled with this
  driver's Brand/Model — a fake but working "go design a box around this
  driver" shortcut).

Cancel now means "revert to how the editor looked when it was opened this
time" (`driverEditorOpenSnapshot`, captured fresh on every `openDriverEditor()`
call) — replacing the old `driverEditorSnapshot`/Reset pairing that
snapshotted once at page load and never changed. Clear is unrelated to
Cancel: it always blanks every field to defaults, in any mode.

## Box-type cascade: 6 enclosure types

`box-type-select` now offers Sealed / Vented / Passive Radiator / 4th Order
Bandpass / 6th Order Bandpass / 8th Order Bandpass (ABC), replacing the
earlier 3-type stand-in. Box tab content splits into two mutually-exclusive
blocks (`#box-single-chamber` vs `#box-dual-chamber`, toggled by
`setEnclosureType()`):

- Sealed/Vented/Passive Radiator keep the existing single "Rear chamber"
  Volume/Fh block, unchanged.
- The three bandpass types show two chambers side by side instead. Chamber
  1 is labeled "(sealed)" for 4th order and "(vented)" for 6th/8th order,
  with its own Fh field only shown when vented. Chamber 2 is always vented.
  The illustration swaps between a generic two-box icon (4th/6th order) and
  a distinct ABC icon for 8th order — bigger bottom chamber (matching the
  "driver mounted on the baffle of the larger chamber" spec), smaller top
  chamber, "ABC" labeled directly on the bottom one.

The enclosure/Vents tab gained three new panes matching each bandpass
type's real vent topology (not guessed — matches the rules the user gave
earlier in this file's now-superseded prompt log): 4th order has only a
**Front chamber vent** (the rear chamber is sealed, no vent); 6th order has
**Rear chamber vent + Front chamber vent** (both chambers open to the
outside, no connection between them); 8th order/ABC has all three —
**Rear chamber vent + Front chamber vent + Intrachamber vent** (the extra
port that connects the two chambers internally, per "Aperiodic Bi-Chamber").
Each vent section reuses the same Number/Diameter/Vent length/1st port
resonance field pattern already established for the plain Vented type,
just relabeled per section — hand-written three times rather than
templated, consistent with this mock's "no premature abstraction" approach
elsewhere.

## Select Driver from within the editor defers activation

Picking a driver via the Driver Editor's own Select Driver button only
populates the editor's own Brand/Model fields (`de-brand-field`/
`de-model-field`) — it does not touch the project's actual driver
(`driver-brand-field`/`driver-model-field` on the Driver tab) until the
editor's **Done** is pressed. Mechanically: `selectDriverFromEditor()` sets
`selectDriverSource = 'editor'` and hides (not closes) the Driver Editor
modal so its session stays live underneath; `confirmSelectDriver()`
branches on that source; either path ends by reopening the editor
(`returnToDriverEditorIfNeeded()`). Direct Select Driver from the Driver tab
(the common case) is unaffected — it still activates immediately, since
there's no editor session to defer into.

Footer button order is Select Driver → Clone... → Clear → **Done** →
Cancel — Done sits second-from-right, immediately before Cancel, matching
standard OK/Cancel placement (not first-of-the-group, which is where it
originally landed).

## Nothing is "saved" until Save Changes / Save as file — even Done

Following on from the Select-Driver fix above: Done (Driver Editor),
Tune's live edits, and a direct Select Driver all only ever update the
project's **in-memory** state — none of them persist anything. That
matches the earlier "Can it save into volatile project WPR storage?"
answer (yes, trivially, that's just JS state) but means there was no
visible signal that the project had unsaved modifications. Added:

- `projectModified` (in `script.js`) tracks this. Set on: any input event
  inside the open Tune panel, Driver Editor's Done (project mode only —
  not My Drivers mode, which doesn't touch "the project"), and a direct
  Select Driver commit.
- **Save Changes** and **Save as file** buttons sit at the **left** of the
  `.parstate-legend` bar at the top of the content panel (the
  Entered/Calculated/Not-available legend stays on the right —
  `justify-content: space-between` across two grouped `<div>`s) and are
  **always visible**, not conditionally shown — exporting must not make the
  save controls disappear. Only their styling reacts to `projectModified`:
  clean = neutral grey; dirty = yellow (`.save-btn.dirty`) plus a pulsing
  "Unsaved changes" label appears next to them. Save Changes is decorative
  (a real build would persist to `localStorage`/IndexedDB here); Save as
  file is a real download of the project's driver + Tune fields
  (`.wpr.txt`, deliberately not claiming real WPR binary/XML
  compatibility, same spirit as the Driver Editor's own `.wdr.txt`
  export). Both clear `projectModified` (back to the neutral styling, not
  hidden).
- Tune counts as its own edit path, distinct from Edit/Done, per the
  earlier Edit-vs-Tune decision — it just wasn't wired into "this leaves
  the project unsaved" until now.

## Clone uses an integrated inline row, not `window.prompt()`

The Driver Editor's Clone.../Save-to-My-Drivers action (`cloneDriverEditor()`)
now shows an inline "Save to My Drivers as" row in the modal footer
(prefilled with a suggested name, Save/Cancel buttons) instead of a native
`window.prompt()` dialog — the same in-place pattern the Tune panel's own
"Save to My Drivers" flow already used. `saveAsNewDriver()` (the Manage
Drivers toolbar menu's "Save as new..." item) still uses `window.prompt()`,
since it's invoked directly from the toolbar with no modal open to host an
inline row in — a deliberate, narrower scope than fixing every prompt in
the mock.
