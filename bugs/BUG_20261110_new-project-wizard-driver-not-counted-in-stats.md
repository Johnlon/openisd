# BUG_20261110_new-project-wizard-driver-not-counted-in-stats

**Status:** RESOLVED (T754)

## Symptom
The stats page's "Drivers picked" list misses most driver choices. A driver chosen in the New
Project wizard (desktop and phone) sends no `driver_pick` event. Only a driver chosen in the driver
library on an open project (desktop Browse, phone Manage drivers) is counted. John, 10 Nov 2026:
"there are very few drivers selected for the number of visits".

## Evidence
- `driver_pick` is sent only from `DriverSelection.selectDriver` (packages/ui/src/logic/driverSelection.ts:159-162, wired in packages/ui/src/main.ts:235).
- Its only callers: packages/ui/src/hooks/MobileManageDriversTab-hooks.ts:23 and packages/ui/src/logic/driverBrowsingState.ts:514.
- The wizard makes the project in `createProject` (packages/ui/src/hooks/OriginalNewProject-hooks.ts:562, used by OriginalNewProject.vue and MobileNewProject.vue) and records only `recentActions.record('new-project')`.
- Stats 4-10 Nov 2026 (openisd.app): 857 launches, 563 projects opened, about 124 driver picks; 600 launches are John's own visitor (ac0b5a97).

## Cause
The wizard puts the driver into the project directly (`appState.createProject`) and never calls the `driverPicked` recorder.

## Fix
T754: `createDriverBrowsingState` takes the same `driverPicked` recorder as `DriverSelection` and calls it when a
library driver goes to a new project (inside the wizard, or with no project open). Passive radiators, asked for at
the same time (John, 10 Nov 2026: "also record the pr picked either on Wiz or in main"): a new `radiator_pick` event
(`logic/telemetry/radiatorPick.ts`), sent from the wizard's radiator step and from the box page, bundled by id and
name, a saved one as `mine`. The collector (openisd-stats) accepts `radiator_pick` and shows "Passive radiators picked".

## Verification
packages/ui/test/logic/driverBrowsingState-picks.test.ts, packages/ui/test/logic/radiatorPick.test.ts, the radiator
pick cases in packages/ui/test/hooks/passiveRadiatorActions.test.ts and OriginalNewProject-hooks.test.ts; openisd-stats
test/store, test/dashboard, test/events. On the live stats page after the release: wizard picks appear under "Drivers
picked", radiators under "Passive radiators picked".
