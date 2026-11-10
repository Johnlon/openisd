# Desktop Driver tab: the driver count and the connection dropdown differ in width

**Status:** CLOSED, fixed: checked on main 8 Nov 2026, both dropdowns 90 px at one left edge. Closed by John on QO456, 8 Nov 2026.

Status: FIXED (T690, 5 Nov 2026; the commit after 1f176cd23 that adds this line). John's ruling: the count keeps the common field size and the connection dropdown takes the same width and left edge. The connection dropdown is now drawn by `UIPickField` with `common`: 124 px wide, left edge 375, same as the count. The gate entries are removed from KNOWN. Found by T690's field layout rules gate (`field-layout-rules.browser.spec.ts`), 5 Nov 2026.

On the desktop Driver tab the Num. of drivers dropdown is 124 px wide and the Voice coil connection dropdown is 90 px wide, and their left edges are 2 px apart (375 and 377 at 1280 x 720). Rules 3 and 4: one left edge, one width in a group. T690 caused it: before T690 both dropdowns were 90 px wide; the count now takes the common field width and the connection did not follow. The connection dropdown is hand-built in OriginalShell.vue, not drawn by the common field.

Rule: `.claude/rules/field-layout.md`. The gate lists this fault as a known one and turns red when it is fixed; then delete the entry in KNOWN.
