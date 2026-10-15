# BUG_20261015_synced-open-project-does-not-refresh

**Status:** FIXED (T181)

## Symptom
John, 15 Oct 2026, on /test/: "synced projects must refresh automatically - after the sync I had to
close and open the project to see the update". A project edited on another device came down with the
next sync, but the project open in the workspace kept showing the old values until it was closed and
opened again.

## Cause
There are two things, the saved project and the open project. A pull writes the saved project; nothing
told the open project, so it kept showing what it had loaded before.

## Fix
- The project docs report each saved project a pull replaced, with the device that saved it. The cloud
  sync wiring hands the list over when the run ends, not during it.
- `followPulledProjects` (`packages/ui/src/logic/pulledProjects.ts`) then, for each open one:
  - nothing unsaved: shows the pulled version in place, in the same tab, with the same focus, trace
    colour and visibility;
  - unsaved edits: never overwritten. The open project is saved as a conflict copy,
    "<name> (conflict, <day>, <this device>)", and stays open as that copy; the pulled version keeps
    the name. The conflict list, the notice and the Diagnostics events name it, as for any conflict.

## Verification
- `packages/ui/test/logic/pulledProjects.test.ts`: refreshed in place; unsaved edits kept as a
  conflict copy; a project that is not open is left alone.
- `packages/ui/test/logic/cloudSyncWiring.firstConnect.test.ts`: two devices over the Drive emulator;
  a pulled edit is handed over with the other device's name.
- `packages/ui/test/ui/cloud-pull-open-project.browser.spec.ts`, desktop and mobile: the open project
  shows the iPhone's edit after Sync now, without reopening. Both fail with the hand-off switched off.
