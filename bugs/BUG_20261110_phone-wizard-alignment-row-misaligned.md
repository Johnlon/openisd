# Phone New project, step 4 (closed and vented): the Alignment value sits at x 16, the number boxes at x 117 or 132

Status: OPEN. Found by T763 (`view-layout-walk.browser.spec.ts`) on 10 Nov 2026, 374 x 705.

In one column the Alignment row has its value at the left edge (16 px) and the number boxes below it start at 117 px (closed) or 132 px (vented). Rule 3: one left edge in a group. We need one edge.

The walk lists it as a known fault (`phone wizard-sealed-4`, `wizard-vented-4`, R3) and turns red when it is fixed; then delete the entry in KNOWN.
