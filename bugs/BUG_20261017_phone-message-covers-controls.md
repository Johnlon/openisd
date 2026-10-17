# BUG_20261017_phone-message-covers-controls

**Status:** FIXED (T346): on the phone a message shows in a strip above the tab bar.

## Symptom
The "Project imported from ..." message is drawn in the middle of the phone screen, over the Box volume input in
the sheet. A message must never cover a control on the phone.

## Fix
The phone shows the app's message in a strip above the tab bar (the slot the update banner uses), not as a
floating box; the floating message stays on desktop.

## Verification
`mobile-sheet-touch.browser.spec.ts`: right after an import the strip shows, no floating message exists, and
no control overlaps the strip.

## Related
Auto Y over the "10" frequency label is BUG_20261017_auto-y-overlaps-first-frequency-label.md, owner maryu,
task T326 (Auto Y on the title row). Not touched here.
