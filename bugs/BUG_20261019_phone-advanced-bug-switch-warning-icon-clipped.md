# BUG_20261019_phone-advanced-bug-switch-warning-icon-clipped

**Status:** FIXED (T446; test: mobile-advanced-tab.browser.spec.ts "the warning mark of every bug switch sits fully inside its row and inside the screen"). The phone rows now draw the mark inside the row; the desktop rows keep the mark on the border, unchanged.

Recorded 19 Oct 2026. Seen on prod, Advanced tab, phone 374x705 CSS px (John's Pixel 9).

## Symptom
On the Advanced tab, under "Enable WinISD bugs", the small ⚠ icon on each yellow switch row is cut
off at the left edge of the panel: only half of it shows. Clipping is a bug.

## Evidence
- Screenshot: [prod-advanced-compat.png](http://lap:8000/winisd/ui-gallery/screens/prod-advanced-compat.png).
  Every yellow row ("Two-BL driver", "Re without Rg", ...) shows a half ⚠ at its left edge.
- `packages/ui/src/ui/components/ErrorSwitch.vue` line 39: `.error-switch-mark` is `position: absolute;
  left: -5px`, so the icon sits 5 px outside the row's left border. Line 36: the row has `border: 1px`
  and `padding: 0 2px 0 6px`.
- On the phone the row starts at the panel's left edge, so the 5 px outside is clipped.
- Component: `ErrorSwitch.vue`, used inside `ErrorSwitchGroup.vue`, placed by
  `packages/ui/src/ui/shells/mobile/MobileAdvancedTab.vue`.

## Cause
The ⚠ is drawn outside the row border (a badge on the border) and the phone panel has no gutter to
hold it, so the panel edge clips it.

## Fix
Draw the ⚠ inside the box, as the classic phone mock does: QO268 Advanced,
[box-combined-live.html?ov=advanced](http://lap:8000/winisd/ui-gallery/QO267/box-combined-live.html?ov=advanced).
Do not fix by adding a gutter to the panel. Layout change: follow the layout rule (this is clipping,
so fix and show before/after).

## Verification
Phone 374x705: the whole ⚠ is visible inside each yellow row, no horizontal scrollbar, label keeps
its width. Before/after screenshots.
