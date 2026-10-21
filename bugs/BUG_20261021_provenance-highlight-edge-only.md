# BUG_20261021_provenance-highlight-edge-only

**Status:** OPEN

## Symptom
With Inspect Provenance ticked in the driver editor, the fields that feed the inspected field are
marked only by a coloured edge on a small box around the field. John (21 Oct 2026, live demo
https://test.openisd.app): "Can we try the provenance dependencies light up the whole row not
just the edge of the box". He wants the whole row (label, value, unit, full row width) tinted in
the same colour, value text colour kept.

## Evidence
`getFieldStyle` in packages/ui/src/ui/components/DriverEditorModal.vue paints a 2px border plus a
faint background on `.de-fld`, which is `width: fit-content` and `justify-self: start` on desktop
(so it is only as wide as its content). Measurements in T521 spec
packages/ui/test/ui/driver-editor-provenance-row.browser.spec.ts.

## Cause
The highlight is a border on a content-sized box, not a background across the row.

## Fix
The feeding field's row spans the full row width and carries the path colour as a background tint,
on both skins. Value text colour is untouched.

## Verification
T521 spec: tinted field spans the full row, an unrelated field is not tinted, value colour still
matches the legend swatch.
