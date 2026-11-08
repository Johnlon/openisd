# BUG_20261108_desktop-whatif-wide-gap-between-labels-and-boxes

**Status:** OPEN

## Symptom
On desktop, the What-if panel puts a wide empty gap between each label and its box: "Fs", "Qes",
"Vb" and the rest sit far to the left of their boxes. John, 8 Nov 2026, on QO449 (the README
What-if picture): "there is too much space between labels and cells".

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
