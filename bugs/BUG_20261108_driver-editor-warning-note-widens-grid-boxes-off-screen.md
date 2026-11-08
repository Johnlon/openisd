# BUG_20261108_driver-editor-warning-note-widens-grid-boxes-off-screen

**Status:** RESOLVED

## Symptom
Desktop, Edit Project's Driver, Parameters tab. Clicking the ⚠ warning glyph by Qes shows the
data-quality note ("Conflicts with other values: Qes, resonance (Fs), moving mass (Mms), coil
resistance (Re), force factor (BL) disagree by 5.5%: Qes = 2π·Fs·Mms·Re/Bl². Every field in the
group is marked …") as ONE unwrapped line inside the grid. The label column grows to the whole
dialog width, every number box in all four columns is pushed off the right edge, and only the
labels remain visible. The dialog is unusable until the note is closed.
John, 8 Nov 2026 03:52, chat: "clicking the dq - must show a popup on the driver editor on
desktop"; screenshot in the T729 worktree's build/.

John, 8 Nov 2026, second screenshot (Vented tab): "Use a popup every where instead of this" (the
inline red refusal note under Tuning freq (Fb) and Vent diameter). Then: "all /!\ to use a popup so
that view corruption and mangling (pushing out of way) cannot occur". Then, of the Vented tab
note: clicking the glyph shows the message but it cannot be dismissed: "make it a popup so this
can't happen". The popup closes on the glyph again, a click outside, Esc, and when the refusal clears.

## Evidence
John's screenshot (dialog about 2200 px wide, production or test build of 8 Nov). The note text
is a single line about 2100 px long starting at the label column's left edge. Not yet reproduced
by an agent.

## Cause
The shared field component (UIFieldBody.vue) laid the note out inside the field's grid as a
second row (grid-column 1 / -1, plus a note-open class that made the row height auto). In the
driver editor's column the note's min-content width widened the label column to the dialog, so
every box was pushed off the right edge; on other tabs it changed the row's height.

## Fix
The note is an absolutely positioned popup under the field (`.ui-field-note`), out of the grid, in
the shared field component, so every screen (driver editor, Vented, Box, phone, What-if) gets it.
The note-open row-height rules in style.css, joined-fields.css and field-catalogue.css are gone.
The glyph toggles it, a refusal opens it, and a click outside, Esc, or a cleared refusal closes it
(Esc closes only the popup, not the dialog). There was no anchored popup component: the
Difference cue opens a modal page, so the popup is the field's own element.

## Verification
Browser spec: open the driver editor, click the Qes warning glyph, assert a popup is visible, the
dialog's scrollWidth equals its clientWidth, and the Qes input's right edge is still inside the
dialog; field-layout gate stays green.

Spec: packages/ui/test/ui/field-note-popup.browser.spec.ts (row box and dialog width unchanged, Qes input inside the dialog, dismissal by glyph, Esc, outside click).

John, QO462, 8 Nov 2026: "ok providing the boxes dont run off the screen" (popup stays inside the window and dialog: shifts left near the right edge, opens above near the bottom); "I want it to dismiss on loss of focus" (Tab or focus to another control closes it).
