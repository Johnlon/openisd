# BUG_20261017_project-not-stored-until-saved

**Status:** FIXED (T271)

## Symptom
John, 17 Oct 2026: a new project is added to storage the moment it is made (New project, the wizard, Open a
file, Duplicate). Later edits mark it unsaved and light Save. Until now an open project that was never saved
was in no stored list, showed as "Not saved", and was lost on Close.

## Fix
- `startStoringNewProjects` (`packages/ui/src/logic/newProjectStore.ts`) stores each project as it opens; `storeNew`
  (`projectRepo.ts`) gives it a stored copy of its own, numbered if its name is taken.
- The wizard and Duplicate name and commit the project before it opens, so its stored copy is final.
- A project the store will not take is not created: it is closed again and a popup says storage is full, with a
  "Show projects" button. A save that fails keeps the stored version and says so.
- The `notSaved` row kind and its "Not saved" mark are gone; Close leaves the project in the list, closed.
- Specs: `newProjectStore.test.ts`, `projectRepo.test.ts`, `project-stored-when-made.browser.spec.ts`. The
  storage-full popup has no browser spec: a spec cannot fill browser storage without a back door.

## Also fixed
Export all listed an open project twice once it was renamed (its stored copy under the old name, and
itself under the new one). It now lists each stored project once, taking the open project's current
state where one is open (`exportProjectsArchive` in `applicationIO.ts`; `projects-across-addresses.browser.spec.ts`).
