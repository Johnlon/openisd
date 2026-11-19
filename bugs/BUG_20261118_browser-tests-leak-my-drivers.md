# Browser tests leak My Drivers from one test to the next

Found by T921 (the vented-picker driver-count journey), "Separate finding" in
bugs/BUG_20261118_vented-picker-ignores-driver-count.md on branch t921.

## Symptom
`packages/ui/test/ui/new-project-wizard.browser.spec.ts` imports its own "Tang Band W5-1138SMF" into My Drivers
through the wizard's file input. The import stayed for every later test on the same Playwright worker, in other spec
files too. A later spec that took the first "W5-1138SMF" in the New Project list got the imported copy (10.60 L,
Fb 36.0028 Hz) instead of the catalogue driver (10.70 L, 35.9002 Hz).

## Cause
`resetApp` (packages/ui/test/fixtures.ts) put back the window, skin, projects, Options and sidebar width, and
`TestAdditions` undid init scripts, listeners, cookies, headers and media. Nothing emptied My Drivers, which the app
keeps in the browser's storage (`openisd_my_drivers`) and which the worker's shared page keeps between tests. The
app is right to keep it; the reset left it.

## Fix
`resetApp` now calls `emptyLibraries` (packages/ui/test/fixtures.ts). It reads what the browser's storage holds in the four
user libraries (saved drivers, saved passive radiators, starred drivers, starred radiators) and opens a library only when
one holds something. Then, as a user does: in Manage Drivers it un-stars each starred driver (Favorites filter, then each
star) and presses the "Remove from My Drivers" cross on each saved row; in the New Project wizard's passive radiator step
it opens the passive radiator library, un-stars each star and presses "Remove this passive radiator from your library"
(the cross) on each saved radiator. It fails the reset if anything is still held afterwards. It does not depend on a spec
registering what it made, and no test is changed. The app does have a user path to remove a saved radiator, so there is
no app bug to report there.

## Proof
`packages/ui/test/ui/reset-between-tests.browser.spec.ts`: the first test imports a driver, stars a catalogue driver,
copies a passive radiator to My PRs and stars it; the next test on the same worker checks none of the four is there.
It fails on the old fixtures (1 saved driver left) and on a reset that does drivers only (1 star left); it passes now.
