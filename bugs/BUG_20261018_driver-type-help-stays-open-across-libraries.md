# BUG_20261018_driver-type-help-stays-open-across-libraries

**Status:** OPEN

## Symptom
Open Manage drivers, tap the driver-type "?" so the "Driver Range Classifications" list shows, then close Manage drivers. Start a new project: the wizard's driver library opens with that list already showing, and its backdrop blocks taps in the wizard until the user taps outside it.

## Evidence
- Seen by the UI gallery worker (T417, run 20261018T192120Z_774848b5): `wizard-pr-step` could not pick a driver until it clicked outside the list.
- `packages/ui/src/logic/driverBrowsingState.ts:205` makes `typeHelpOpen` once in the app-wide driver-browsing state; `packages/ui/src/ui/components/DriverLibrary.vue:92-112` reads and toggles that one ref. Every driver library (Manage drivers, wizard, driver tab) shares it, and closing a dialog does not reset it.

## Cause
The help list's open state is app-wide, so it outlives the library it was opened in.

## Fix
Make the help list's open state belong to each library instance (local to DriverLibrary), so it starts closed every time a library opens.

## Verification
A browser spec opens Manage drivers, opens the type help, closes Manage drivers, starts a new project, and sees no "Driver Range Classifications" list. Then drop the click-outside step in `scripts/ui-gallery/screens.mjs` `wizard-pr-step`.
