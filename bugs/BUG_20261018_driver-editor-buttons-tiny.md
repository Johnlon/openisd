# Driver editor: buttons tiny and unusable, and the dialog looks totally different from the rest of the app

Status: open. John, 18 Oct 2026, reviewing main for the 7.0.953 cut: "the driver editor buttons are tiny and unusable".

## What is wrong

In the driver editor the buttons are too small to use on the phone. The release gate for touch
targets is 44 px; these are below it.

## Also wrong (John, same review)

"The driver editor seems to have been forgotten or damaged and it looks totally different." The dialog
has not been brought onto the shared field components the tabs use, so it is styled on its own and
drifts from every other screen. John asked for consistency through reused common components.

## Fix

The driver editor is rebuilt from the same field and button components as the tabs, so it looks like the rest of the app on both skins. Every button is at least 44 px tall and wide enough to read, on both skins.
Before/after screenshots at John's phone size (374×705 @ 2.566) go with the fix. A spec measures
the buttons.

## Open

Which screen exactly: the driver edit dialog (phone and desktop) is the first place to look; John
confirms from the screenshots.
