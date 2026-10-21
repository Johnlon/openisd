# BUG_20261019_desktop-advanced-winisd-bugs-group-cut

**Status:** RESOLVED

Recorded 19 Oct 2026 by bob, from the QO269 prod capture.
Resolved 21 Oct 2026 by opi (T537).

## Symptom
On the desktop Advanced tab at 1280x800 (test.openisd.app, W5-1138SMF vented project) the
"Enable WinISD bugs" group is cut off by the right edge of the panel: only the first letter or two
of each switch name show ("Two", "Re", "P", "B", "A", "P", "S", "T"), and the other two groups on
the tab leave it no room. The heading of the group before it, "Enable WinISD-style …", is cut to
an ellipsis. The user cannot read or tick the bug switches.

Picture: ui-gallery/QO269/prod-desktop-advanced.png (served at
http://lap:8000/winisd/ui-gallery/QO269/prod-desktop-advanced.png).

## Cause
Five columns were arranged horizontally side by side across `.adv-two-col`: Air constants (253px),
Air readouts (231px), standard WinISD checkboxes (214px), WinISD-style options (157px), and WinISD bugs
(184px). Total width exceeded 1090px, whereas available panel width at 1280x800 is 945.5px. The 5th
column was clipped by 142px at the right boundary.

## Fix
1. The air fields and the standard WinISD options (`.checkbox-col`) share one left column, `.adv-left-col`;
   the options are a 3-row grid with no row gap.
2. The left column is 181 px tall (air fields 96 + gap 4 + options 81), under the 185 px the other tabs give
   the shared panel, so no other tab changes.
3. The tab now has two columns: air fields and options on the left (500 px), the Compatibility box on the
   right (367 px), 875 px with the gap, inside the 945 px pane at 1280x800.
4. `packages/ui/test/ui/original-advanced-tab.browser.spec.ts` checks at 1280x800 and 1600x900 that every
   "Enable WinISD bugs" label is inside the panel, the pane has no scrollbar, and the Advanced tab is not
   the tab that deepens the shared panel. `packages/ui/test/ui/OriginalShell-advanced-layout.test.ts`
   checks the column structure.
