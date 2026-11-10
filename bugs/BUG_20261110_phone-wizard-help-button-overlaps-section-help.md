# Phone New project, step 1: the wizard Help button sits 3 px over the "?" of the first section band

Status: OPEN. Found by T763 (`view-layout-walk.browser.spec.ts`) on 10 Nov 2026, 374 x 705, every box type (wizard step 1).

There are two buttons, the wizard Help button (`.mob-np-help`) and the "?" of the first section band (`.mob-band-help`). They overlap by 22 x 3 px. We need them apart.

The walk lists it as a known fault (`phone wizard-<box>-1`, R7 and W4) and turns red when it is fixed; then delete the entry in KNOWN.
