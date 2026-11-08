# BUG_20261108_desktop-whatif-wide-gap-between-labels-and-boxes

**Status:** FIXED on branch t742 (all desktop screens; see the T742 section)

## Symptom
On desktop, the What-if panel puts a wide empty gap between each label and its box: "Fs", "Qes",
"Vb" and the rest sit far to the left of their boxes. John, 8 Nov 2026, on QO449 (the README
What-if picture): "there is too much space between labels and cells". Then, QO449.c16: "fix the gaps on all fields".

The common field's own label column is a fixed width too: `--ctl-label-w` 150px
(`packages/design/fields/desktopSizes.ts`, `DesktopSizes.LABEL_COL_PX`, read by `UIFieldBody.vue`,
`UIPickField.vue` and `joined-fields.css`), and screens override it with about 15 hand-set
`--label-w` values. So the gap shows on other desktop screens as well (e.g. the Box tab: "Volume"
label, box about 95 px to its right). Scope (What-if only or every screen) is with the leader.

## Evidence
- README picture `ui-gallery/T696-readme-docs/whatif.after.png` (1600×950, main at f13022f42):
  label "Fs" starts at x≈909, its box at x≈1040; about 120 px of blank between short labels and
  their boxes.
- `packages/ui/src/ui/shells/original/OriginalWhatIf.vue:170-181`: every field's label slot is a
  fixed `--label-w:128px`, plus `margin-right:22px`, "to reserve enough room for 'Front port area'".

## Cause
The label column is sized for the longest label any box type can show ("Front port area"), not
for the labels the panel shows. A vented project's longest label is "Port length", so every row
carries the unused width.

## Fix
Size the label column to the longest label the panel actually shows, still one width for every
row so the boxes stay in one aligned column (field-layout rule), with the usual small gap.

## Verification
Browser spec on the desktop What-if panel for a vented project: the gap between the longest
label's right edge and its box is the app's normal label gap, every box starts at the same x,
and nothing is clipped; same check for a bandpass project that shows "Front port area".

## Follow-up (John, 8 Nov 2026, chat via cover)
"still too much gaps - reduce the field widths by 25%, reduce gap between label and text fields".
- Boxes 124 px → 93 px (25% narrower); the What-if unit chip is 29 px (the common field's minimum
  is 34 px; at 93 px with 34 px the Bl value "13.50000" was clipped). Spec: `what-if-panel` and
  `field-layout-rules` assert 93 px.
- The label gap after the longest label stays the desktop's 22 px warning slot; whether to close it
  on the What-if only is asked on QO455.
- Hint and Close titles now say "Your project will not be updated" (John's words).

## Every desktop screen (T742, John, 8 Nov 2026, QO466.c12)
On the desktop 1536 Box tab picture: "regression as the input fields are too far from the labels, this is
problematic in many places please fix here". The What-if fix (T712) did not reach the other screens: their label
column was the common field's fixed 150 px (`--ctl-label-w`) or one of 15 hand-set `--label-w` values, so "Volume"
sat about 104 px left of its box.

Fix (T742): every desktop field group's label column is its longest label plus the one warning slot
(`DesktopSizes.LABEL_SLOT_PX`, 22 px, the same on every screen; `DesktopSizes.labelColumnPx`). A group is the
field rows of one tab or dialog whose labels start at one x; `packages/ui/src/hooks/labelColumns.ts` measures the
labels and gives every row of the group that one width, so the boxes still share one left edge (field-layout rule
3). The hand-set `--label-w` values (Box, Driver, Passive Radiator, Vents, Signal, Advanced, Filters, wizard) are
gone, and desktop labels never wrap. The vent columns now take their fields' width instead of a fixed 400 px.

Verification: `packages/ui/test/ui/field-layout-rules.browser.spec.ts`, "each group's boxes sit next to its
longest label": every box type, every tab, the wizard's step 2 and radiator step, at 1366x768, 1536x864 and
1440x900; the blank after the longest label is at most the slot plus 4 px, no label wraps, nothing is cut. It
failed on the old code (e.g. "Volume" ends 104px before its box) and passes now.

**Status:** FIXED on branch t742 (not yet landed).
