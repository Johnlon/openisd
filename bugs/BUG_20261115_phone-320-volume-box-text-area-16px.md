# At 320 px wide the phone Box tab's Volume box has a 16 px text area, and its centre is the unit chip

Found 15 Nov 2026 fixing the main-red `cloudSync.mobile` spec (T800). Since T742 (ee3029c2) the vented, bandpass and ABC Box pages size the label column to the longest label (126 px at 374 px wide). At 320 px the Volume box is 72 px wide with a 16 px left and a 40 px right padding: 16 px of text area, so a value such as 10.70 is cut, and the box's centre lies on the unit chip, so a tap at the centre toggles the unit instead of focusing the box.

320 px is not one of the layout-covered phone sizes (`packages/ui/test/fixtures/phoneSizes.ts`, 360 px and up), so no gate sees it.

Next: John to say whether 320 px must be supported; if it must, add it to PHONE_SIZES and give the Box tab a column that leaves a value readable.
