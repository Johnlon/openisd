# Desktop What-if panel scrolls up and down; wizard count is narrower than the connection dropdown

**Status:** OPEN for the What-if panel scroll (48 px at 1280x720, 8 Nov 2026). The wizard count width part is fixed (both dropdowns 90 px) and closed by John on QO456.

Status: OPEN for the What-if panel scroll. The wizard part is FIXED (T690, 5 Nov 2026; the commit after 1f176cd23): John ruled the connection dropdown takes the count's width, so both are 124 px wide at left edge 435 in wizard step 2 (`UIPickField` with `common`); its KNOWN entry is removed. Found by T690's field layout rules gate (`field-layout-rules.browser.spec.ts`), 5 Nov 2026.

The desktop What-if panel scrolls up and down by 14 px at 1280 x 720 (rule 2: a scrollbar is better than clipping, but neither should happen). In the desktop New project wizard step 2 the driver count is 124 px wide and the connection dropdown is 180 px wide (rule 4); T690 caused it: before T690 both were 180 px wide (the count was a hand-built dropdown). John passed that screen (picture 6) before the rule was cast, so it is his choice whether the connection dropdown follows the count's width.

Rule: `.claude/rules/field-layout.md`. The gate lists this fault as a known one and turns red when it is fixed; then delete the entry in KNOWN.
