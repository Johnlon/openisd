# Box and Advanced tab buttons are 40 px tall, under the 44 px touch minimum

Status: open. Found 18 Oct 2026 while rebuilding the driver editor on shared components (T418).

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
