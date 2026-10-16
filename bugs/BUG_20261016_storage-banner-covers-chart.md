# BUG_20261016_storage-banner-covers-chart

**Status:** NOT A DEFECT (spec added)

## Symptom (as reported)
Desktop: the storage warning banner hides the top of the chart area under the open chart menu
(shots-regress-20261016, row 15).

## Finding
The banner is an in-flow child of `.original-root` (a flex column), so it takes layout space; nothing
sits under it. What overlaps the banner in the picture is the chart-type menu, a popup that opens over
whatever is below the toolbar by design.

## Verification
`packages/ui/test/ui/persistence-banner-layout.browser.spec.ts`, both skins, banner showing and a
project open: no in-flow sibling's box intersects the banner, the first element after the banner starts
at or below its bottom edge, and the page has no scrollbar and nothing pushed past the window bottom.
Passes. If the banner is wanted out of the way of the menu, that is a new ruling (the menu would open
below the banner instead of over it), not a layout bug.
