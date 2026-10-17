# BUG_20261017_same-name-projects-show-as-one-row

**Status:** FIXED (T271)

## Symptom
John, 17 Oct 2026: "I have two projects called ABC and only one shows in the project page and I can
see two charted lines." Two open projects with one name show as one row, in both Projects pages.

## Cause
There are two things, the store and the list. The store matched a project to a stored project by
name, so saving the second ABC took the first ABC's stored id and overwrote its saved text. The list
then looked open projects up by stored id, so two open projects holding one id became one row.

## Fix (John's ruling, 17 Oct 2026: no automatic renaming)
- The store never matches a project by name (`saveToStorage` in `packages/persistence/src/repos/projectRepo.ts`
  keeps a project's own stored id), and the start-up merge of same-name stored projects is gone: it dropped
  all but one. Two projects called ABC are two stored projects, both called ABC, told apart by their
  Modified date on the row.
- Opening a file that is already stored (same file, same content) focuses the stored project; a different
  file with the same name is a new project with that name.
- The list (`packages/ui/src/hooks/projectBinView.ts`) gives a row to every open project.
- Specs: `projectRepo.test.ts`, `projectBinView.test.ts`, `same-name-projects.browser.spec.ts`.
