# BUG — driver-editor Dimensions rows are padded 24px apart

# Status
OPEN

## Symptom

The Dimensions tab's eight fields are spread down the panel with a wide band of empty space
between each one, so they no longer read as a single list.

Measured gap between the bottom of one input and the top of the next
(`packages/ui/test/ui/driver-editor-layout.browser.spec.ts`): **24px, uniformly, on all seven
gaps** — nearly as much air as the 24px inputs themselves.

WinISD's own page (`docs/winisd/edit_driver_pg4_dimensions.png`) puts the same eight rows on a
tight pitch — the gap is a few pixels, and the eight read as one column.

## Cause

Two spacings stack on the same rows:

```css
.de-body      { gap: 6px; }              /* flex column gap, applies to every child */
.de-dims .de-fld { margin-bottom: 10px !important; }
```

plus each field's own `padding: 2px 4px` top and bottom, and a `gap` on the `.de-dimlist`
column. Individually each looks small; on a row whose input is 24px tall they sum to a gap as
tall as the content.

## Fix

Spend the vertical space once, not four times: keep ONE source of row spacing on the dimension
list and drop the per-field bottom margin, so the gap lands at WinISD's pitch (a few px, not
24).

## Verification

`packages/ui/test/ui/driver-editor-layout.browser.spec.ts`,
`Dimensions: the rows are not spaced out` — measures every consecutive input-to-input gap in
`.de-dimlist` and fails if any exceeds 8px.
