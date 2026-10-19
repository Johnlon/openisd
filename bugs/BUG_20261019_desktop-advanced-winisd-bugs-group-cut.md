# BUG_20261019_desktop-advanced-winisd-bugs-group-cut

**Status:** OPEN

Recorded 19 Oct 2026 by bob, from the QO269 prod capture.

## Symptom
On the desktop Advanced tab at 1280x800 (test.openisd.app, W5-1138SMF vented project) the
"Enable WinISD bugs" group is cut off by the right edge of the panel: only the first letter or two
of each switch name show ("Two", "Re", "P", "B", "A", "P", "S", "T"), and the other two groups on
the tab leave it no room. The heading of the group before it, "Enable WinISD-style …", is cut to
an ellipsis. The user cannot read or tick the bug switches.

Picture: ui-gallery/QO269/prod-desktop-advanced.png (served at
http://lap:8000/winisd/ui-gallery/QO269/prod-desktop-advanced.png).

## Cause
Not yet found. Five columns (air, sound, six checkboxes, WinISD-style group, bugs group) need about
1090 px; the panel gives about 946 px at 1280 wide.

## Fix
1. A browser spec at 1280x800 that opens the Advanced tab and fails when any switch label is cut
   or outside the panel.
2. Make the groups fit without clipping. Which layout change is wanted (wrap a column, move a
   group) is a layout ruling: John's "classic WinISD layout" applies, so ask before moving anything.
