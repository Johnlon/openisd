# Box and Advanced tab buttons are 40 px tall, under the 44 px touch minimum

Status: FIXED (Advanced tab by T515, Box tab by T542). Found 18 Oct 2026 while rebuilding the driver editor on shared components (T418).

## What is wrong

On the phone, the Box tab buttons ("Choose alignment", "Box losses ->", Cancel, Accept, Reset, OK) and the
Advanced tab button ("Reset to app levels") are 40 px tall. The touch minimum is 44 px
(`SheetSizes.TOUCH_MIN_PX`). The Driver and Enclosure tabs, and now the driver editor, use the shared
44 px `.mob-btn` in `style.css`.

## Why

`MobileBoxTab.vue` and `MobileAdvancedTab.vue` each carry their own scoped `.mob-btn` copy
(`min-height: 40px`, white fill), which wins over the shared one.

## Fix

Delete both scoped copies so the shared `.mob-btn` / `.mob-btn-primary` apply. This changes the look of
those two tabs (44 px tall, accent outline), so it needs John's word first: layout freeze.

## Resolution (21 Oct 2026)

John's rule (17 Oct, QO291.c36; fable's answers c47 and c65): one 44 px phone button app-wide, so no
further word was needed.
- Advanced tab: T515 made "Reset to app levels" a PhoneButton.
- Box tab (T542): "Choose alignment" and "Box losses" are now links (`.mob-clink`, T464). The sheets'
  Cancel, Accept, Reset and OK are PhoneButton; the scoped `.mob-btn` copy is deleted. Accept and
  Cancel call the editor methods (`editor.accept()`), since a method passed bare through a
  component's emit loses its object.

## Verification
- `packages/ui/test/ui/MobileBoxTab-buttons.test.ts` (unit): the four buttons are PhoneButton and the tab
  has no scoped `.mob-btn` rule; red on the old file, green now.
- `mobile-alignment-popup` and `mobile-box-losses-popup` browser specs: each button is
  PhoneRowSizes.BUTTON_PX tall (40 before, 44 now).
