# Phone driver editor: Provenance card is see-through and covers the field rows

**Status:** CLOSED (T481). The card's path boxes were 95% transparent and the tapped row could sit under the card; the card is now solid and the editor body scrolls the tapped row above it (bottom padding = card height).

## Symptom
On the phone (374x705), driver editor, Inspect Provenance ticked, a field tapped: since T470 the
Provenance card docks over the lower half of the editor body. It is translucent, so the field rows
(Fs, Vas, Mms, Cms) show through it and the two layers read as one blurred picture. John, 20 Oct 2026,
on the fixes page: "entirely corrupt, looks like double exposure".

## Evidence
ui-gallery/fixes-20261019/driver-editor/inspector-side-by-side.png (workspace repo), right panel.

## Fix
The card is opaque and does not cover the rows being read: a proper bottom sheet from the shared phone
sheet components, with the editor body scrollable above it. Test first: a browser spec opens the card
and checks the card's background is opaque and that the tapped field's row is not under the card.
Before/after with `ui-gallery/bin/before-after.sh --mark` at `--scale 2`.
