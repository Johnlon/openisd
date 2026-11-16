# Desktop Alignment popup: the Alignment list starts 2 px to the right of the number boxes under it

Status: OPEN. Found by T781 (`view-layout-walk.browser.spec.ts`, views `desktop/enclosure/sealed-alignment` and `desktop/enclosure/vented-alignment`) on 10 Nov 2026, 1440 x 900.

In Box tab, Alignment, the Alignment drop-down starts at x 522 (closed box) and 556 (vented box) while the Volume box starts at x 520 and 554 and the Tuning freq box at x 554, so the three controls do not line up on the left. We need one left edge for the list and the number boxes.

The walk lists both views as known faults (R3) and each turns red when the edges match; then delete the entry in KNOWN. The phone has the same fault in its wizard (`BUG_20261110_phone-wizard-alignment-row-misaligned.md`).
