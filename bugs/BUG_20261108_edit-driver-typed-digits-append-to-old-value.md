# BUG_20261108_edit-driver-typed-digits-append-to-old-value

**Status:** OPEN

## Symptom
Edit Project's Driver, Parameters tab, desktop. Typing a new value into a number box leaves the
old text in front of it: Qes shows `0.5680.570` (old 0.568, typed 0.570 still selected), Vas shows
`5.744.85`. Both then show "is not a number — enter a value above 0, up to …". The red error box
under Vas sits on top of the Vas row label and the row's own text runs behind the box ("1 … 08."
peeks out at the right). Mms, BL and Cms are outlined red although their values are valid. The dialog's fourth column
(Fs, Re, Sd, Vd, SPL) is cut off at the dialog's right edge: the boxes show only their first
digits and no unit or spinner (second screenshot, full dialog, about 2200 px wide).
John, 8 Nov 2026 03:45, chat: "serious ui bug", with a screenshot.

Steps (John, 8 Nov 2026), Auto calculate unknowns ticked: click into Qes, select all (Control+a),
cut (Control+x), press Tab. The app calculates Qes and fills the box (e.g. 0.539). Click back into
Qes and press Control+z. The box then shows the old text and the calculated text merged
("0.5680.570" style) with the error "Qes is not a number". It happens in every number box in the
driver editor, not only Qes and outside it: the Vented tab's tuning frequency (Fb) and vent diameter show it too. It is every number box in the app (spec: qes-cut-tab-undo, run on Qes, Vas, Mms, Fb and vent diameter).

## Evidence
John's screenshot, 8 Nov 2026 (build not stated; production 7.0.959 v20261108T0032Z or the
test site v20261108T0254Z). Not yet reproduced by an agent.

## Cause
Verified. The browser's own undo (Ctrl-Z, a `historyUndo` input event) replays the cut against a box whose text the
app has since rewritten (the calculated value was put in the box by script), so the old text is
re-inserted in front of the new: "0.5680.570". The shared number field accepted that text and
refused it as "not a number". Typed digits alone do not concatenate (a second "." is refused as
typed; select-all and display reformatting are not the cause).
The red message box: with a refused entry it already sits in its own field's row (grid row 2, the
row grows); spec `qes-cut-tab-undo` measures that on Qes, Vas and Mms and found no overlap in this
build, so the overlap in John's screenshot was not reproduced here.

## Fix
`useNumInput` (packages/ui/src/hooks/NumInput-hooks.ts, the one shared number field): `beforeinput`
`historyUndo` and `historyRedo` are cancelled; undo reverts the box to the stored value and clears the
refusal (same as Esc), redo does nothing.

Second pass (John, 8 Nov 2026 04:28, "CTRL-Z doesn't work at all now": reverting to the stored value did
nothing after Tab, because the stored value was already the calculated one). The number box has its own
one-step undo: it remembers the value (and its entered precision) from before its last committed edit,
including a commit that emptied the box and let auto-calculate fill it. Ctrl-Z puts that value back in
the box AND commits it (emits the model update) so the app recalculates; a second Ctrl-Z swaps back, so
it never dead-ends. Ctrl-Z while an edit is still being typed reverts the text to the stored value (as
Esc does) and leaves the history alone. The browser's own undo/redo stay cancelled.

## Verification
`bash scripts/test.sh packages/ui/test/ui/qes-cut-tab-undo.browser.spec.ts` (9 tests: Qes, Vas, Mms,
Fb, vent diameter cut-Tab-Ctrl-Z restores the original value and commits it; refused-entry note inside its row on Qes, Vas, Mms). Red before the
fix ("0.5680.570", "5.764.85", "33.9228.81"), green after. field-layout-rules gate green. Unit: NumInput-hooks.test.ts (12 -> 15 + Tab -> Ctrl-Z gives 12 -> Ctrl-Z gives 15).
