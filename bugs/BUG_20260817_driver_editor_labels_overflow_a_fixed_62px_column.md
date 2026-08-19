# BUG — driver-editor labels overflow a fixed 62px column: clipped text, overlap, and H-scroll

# Status
OPEN

## Symptom

Three faults on the driver editor, all visible at once:

1. **Dimensions labels paint over their input.** "Basket Plate Thickness (Thick)" renders as
   `Basket Plate T[input]ck)m` — the label text runs under the input box and the unit.
2. **The window scrolls horizontally.** On Parameters, "Electro-Mechanical parameters" and the
   right-hand column are cut off past the right edge.
3. **The provenance highlight extends left, past the label.** The pink/blue rounded box around
   e.g. `Vas` starts well to the LEFT of the word "Vas", covering empty space.

## Cause — ONE declaration, three symptoms

```css
.de-fld label {
  width: 62px !important;
  flex: 0 0 62px !important;
  text-align: right !important;
}
.de-fld label { white-space: nowrap; }
```

A HARD 62px label box that never grows, holding text that is never allowed to wrap.

- **(1) overlap** — a label wider than 62px cannot wrap and cannot widen, so it overflows its
  box and paints across whatever follows. Every Dimensions label is now well over 62px:
  "Driver Displacement Volume (Dvol)" is roughly 190px.
- **(2) H-scroll** — `.de-cols` is `grid-template-columns: repeat(3, max-content) 1fr`. A track
  sized by `max-content` measures the DECLARED widths, and the label declares 62px however long
  its text is. The overflowing text is not counted, so the tracks are too narrow, content paints
  outside them, and the row's real width exceeds the modal.
- **(3) highlight too far left** — with `text-align: right` in a 62px box, a SHORT label like
  "Vas" leaves ~40px of empty box to its left. `.de-fld` carries the provenance highlight, so
  the highlight covers that empty space.

So a fixed label column is wrong in both directions at once: too narrow for the long labels,
too wide for the short ones.

## Fix

Size the label column to content, and let every row share one column edge so the fields still
line up — a shared grid track rather than a per-field fixed width. The label must be fully
visible, never overlap its input, and the highlight must start at the label's own text.

## Verification

`packages/ui/test/ui/driver-editor-layout.browser.spec.ts` — measured in a real browser, since
none of this is observable from the markup:

- every label's `scrollWidth <= clientWidth` (nothing clipped);
- for every field, `label.right <= input.left` (nothing overlaps);
- the editor does not scroll horizontally;
- each `.de-fld` starts within a few px of its label's rendered text.
