# BUG_20261031_advanced-tab-scrolls-sideways-at-1280

**Status:** RESOLVED

## Symptom
Desktop Original skin, new project, Advanced tab, 1280x800: the tab pane scrolls sideways by 278 px
(content 1225 px in a 947 px pane). At 1366x768 it scrolls 192 px. It fits only from 1600 px.
Production (25 Oct build) is 945 px wide and fits at 1280. The two switch groups ("Enable WinISD-style
..." and "Enable WinISD bugs") start at x=1094 on test against x=715 on production: about 380 px of new
width sits left of them.

## Evidence
Measured on the T634 worktree build at 1280x800 (pane left 223): air fields 223..859 (two columns, 320 and
308 px wide), standard options 867..1081 (214 px), Compatibility box 1089..1448 (359 px). Sum 1225.

## Cause
The air fields are a two-column grid (`.adv-air-fields`, `OriginalShell.vue`) that is always two columns wide
(636 px) and never shrinks. T607 made its rows wider: label column 130 px, value box 134 px (146 px for the
three entered rows), unit chip 60 px, spinner column 38 px (`joined-fields.css`, `.adv-air-fields .ui-field`
rules). The 25 Oct rows were about 190 px wide, so the whole left block was about 380 px narrower.
John's sizes (rows 134 px, chip 60 px) are right; the block has no way to give width back.

## Fix
`.adv-air-fields` becomes a wrapping flex row of two column wrappers (entered rows; calculated rows plus the
reset button). It may shrink (`flex: 0 1 auto`) and the wrapper columns wrap under each other when the pane is
too narrow, as the ABC port columns do. The row sizes are unchanged. The standard options and the two switch
groups stay in one nowrap row. At 1280 the air fields become one column of five rows (350 px) and everything
fits; from 1600 px they stay two columns.

## Verification
- browser: `original-advanced-tab.browser.spec.ts` "the Advanced tab fits at 1280x800 and 1366x768".
- unit: `packages/ui/test/architecture/advanced-air-fields-wrap.test.ts` pins the wrapping CSS.

## Result
Final run (original-shell-layout, original-advanced-tab, visual): 133 passed, 1 failed. The failure was the
existing "two aligned columns" test, which assumed two air columns at the default window; it now widens the
window first. The new 1280x800 and 1366x768 tests pass; the visual baselines are unchanged (1880 px wide),
so only SOURCES.sha256 was refreshed.
