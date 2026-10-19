# BUG_20261019_phone-menu-stays-open-after-save-as-export

**Status:** OPEN

Recorded 19 Oct 2026 by fable, from bob's sweep of test.openisd.app at 374x705.

## Symptom
Phone hamburger menu: after any Save As or Export item, the menu stays open and covers the
result banner, so the user never sees the result.

Intended (classic phone mock, menu closes and the message shows): http://lap:8000/winisd/ui-gallery/QO267/box-combined-live.html?ov=menu&saveas

## Evidence
- packages/ui/src/ui/components/ExportMenu.vue:15-18,32-37: every item calls `close()`, which sets only its own `open` ref false (the dropdown).
- packages/ui/src/ui/shells/mobile/MobileShell.vue:196: `<ExportMenu class="mob-menu-item mob-menu-export">` is given no way to close the phone menu; compare Save / Save all on lines 194-195, which call `closeMenu()`.
- MobileShell.vue:154 overlay is gated by `menuOpen`; the flash banner is at line 110.

## Cause
There are two menus, the phone hamburger menu (MobileShell, `menuOpen`/`closeMenu`) and the Save As / Export dropdown (ExportMenu, own `open`). Export items close the second, never the first.

## Fix
ExportMenu tells its host an item was chosen (an emitted event); MobileShell calls `closeMenu()` on it. Menu closes, banner visible.

## Verification
Browser spec at 374x705: menu, Save As / Export, each item; menu overlay gone and flash banner visible.
