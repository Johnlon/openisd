# BUG_20261018_driver-type-help-stays-open-across-libraries

**Status:** RESOLVED

## Symptom
Open Manage drivers, tap the driver-type "?" so the "Driver Range Classifications" list shows, then close Manage drivers. Start a new project: the wizard's driver library opens with that list already showing, and its backdrop blocks taps in the wizard until the user taps outside it.

## Evidence
- Seen by the UI gallery worker (T417, run 20261018T192120Z_774848b5): `wizard-pr-step` could not pick a driver until it clicked outside the list.
- `packages/ui/src/logic/driverBrowsingState.ts:205` makes `typeHelpOpen` once in the app-wide driver-browsing state; `packages/ui/src/ui/components/DriverLibrary.vue:92-112` reads and toggles that one ref. Every driver library (Manage drivers, wizard, driver tab) shares it, and closing a dialog does not reset it.

## Cause
The help list's open state is app-wide, so it outlives the library it was opened in.

## Fix
`typeHelpOpen` is now a local ref in `DriverLibrary.vue`, so each library instance starts with the help list closed. It is removed from the shared driver-browsing state and its interface. The click-outside step in `scripts/ui-gallery/screens.mjs` `wizard-pr-step` is removed.

## Verification
`packages/ui/test/ui/driver-type-help-per-library.browser.spec.ts` (desktop and phone 374x705): opens Manage drivers, opens the type help, closes Manage drivers, starts a new project, expects no "Driver Range Classifications" list and a driver pickable. Failed before the fix (list still showing), passes after.
