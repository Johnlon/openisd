# BUG — the equation-inspector popup overlaps the driver editor it explains

# Status
FIXED

## Symptom

Driver editor → Inspect Provenance → click a field's label. The "Provenance: <field>" popup
opens pinned to the bottom-right corner of the viewport and, depending on where the 770px-wide
editor modal itself sits, renders on top of the very panel it is explaining — covering the
Miscellaneous parameters section in the reported case.

## Cause

`EquationInspectorModal.vue`'s root card was positioned unconditionally relative to the
viewport:

```css
.eq-inspector-card { position: fixed; right: 20px; bottom: 20px; width: 380px; ... }
```

with no awareness of where `.de-modal` actually rendered. The modal is centred by its flex
parent (`.overlay { display: flex; align-items: center; justify-content: center; }`), so its
left/right margins shrink as the viewport narrows; a fixed viewport-corner popup and a centred
modal have no relationship to each other, and nothing kept them apart.

A first fix picked whichever of four bands around the modal (right/left/below/above) had the
most free space, and stayed within that band's axis. Two more failures surfaced from live use,
not from the automated suite, which only checked one viewport shape each time:

1. The right/left branches placed a fixed-380px box without checking the band actually had
   380px — on a 1200px-wide viewport it started inside a band with only ~215px and ran off the
   far edge of the window (reported: "runs off the right side of the page").
2. The below/above fallback picked whichever band had more raw space without checking the
   popup's own ~380px HEIGHT fit there either — at an ordinary (not maximized) window height,
   "below the modal" had only a sliver of space, and the popup rendered starting past the
   bottom of the viewport: present in the DOM, entirely invisible (reported: "doesn't show at
   all", confirmed live with a rebuilt local build, not a stale-cache artifact).

## Fix

`DriverEditorModal.vue` measures `.de-modal`'s own `getBoundingClientRect()` (via a template
ref) and always places the popup beside the modal's RIGHT edge — the human's explicit call,
made after the multi-band logic proved fragile in practice. Both axes are then hard-clamped
into the viewport: `left`/`top` are `Math.min(Math.max(gap, …), viewport − gap − size)`, and the
width shrinks (floor 200px) if the window is too narrow for the full 380px beside the modal.
Visibility is the invariant that is never traded away — on a viewport too narrow to clear the
modal's right edge entirely, the popup may brush the modal, but it is never rendered off-screen.
Recomputed on open and on window resize.

The computed style is passed as `:style` on `<EquationInspectorModal>`; Vue's attrs fallthrough
applies it as an inline `style=""` on the component's root element, which outranks the
component's own unconditional CSS without needing `!important`.

## Verification

`packages/ui/test/ui/driver-editor-provenance-and-units.browser.spec.ts`:
- `the equation-inspector popup never overlaps the editor, even on a narrow viewport` — opens
  the popup at a 1200px viewport and asserts the popup's and modal's bounding boxes do not
  intersect, AND that the popup's right edge stays within the viewport.
- `the equation-inspector popup is visible on screen at a normal window height` — opens the
  popup at the suite's default (720px-tall) viewport and asserts its full bounding box, top to
  bottom, lands inside `[0, window.innerHeight]`.
