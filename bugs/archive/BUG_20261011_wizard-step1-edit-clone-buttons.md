# BUG_20261011_wizard-step1-edit-clone-buttons

**Status:** FIXED (T040 f3373630, typed host `DriverListMode` = manage | pick; spec `new-project-step1-driver-buttons.browser.spec.ts` covers both skins; closed T208)

## Symptom
John, 11 Oct 2026: "the driver edit button on the step 1/5 does nothing, delete it"; "delete clone driver too". In the new-project wizard, step 1 (pick a driver), the driver summary shows Edit and Clone driver buttons. Edit does nothing there.

## Evidence
- packages/ui/src/ui/components/DriverLibrary.vue:244-247 renders Clone driver and Edit in the summary for every host.
- Hosts: DriverBrowser.vue and MobileManageDriversTab.vue (managing drivers), OriginalNewProject.vue:132 and MobileNewProject.vue:127 (wizard step 1, `host-footer`).

## Cause
DriverLibrary is shared by the driver manager and the wizard's picker, and shows the manager's Edit and Clone buttons in both.

## Fix
DriverLibrary takes its host as one typed value (manage | pick) instead of optional booleans; Edit and Clone driver show only when managing. Both wizard skins pass pick.

## Verification
Browser: wizard step 1 on both skins shows no Edit and no Clone driver button; the driver manager still shows both and they still work.
