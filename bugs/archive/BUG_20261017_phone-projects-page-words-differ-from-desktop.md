# BUG_20261017_phone-projects-page-words-differ-from-desktop

**Status:** FIXED (T271)

## Symptom
With no project the phone Projects page says "No saved project yet." and the desktop list says "No
projects yet." The phone's no-match and empty-Bin lines also end in a full stop that the desktop's do not.

## Cause
The phone page had these three lines typed into its template. The words belong to design
(`PROJECT_LIST_TEXT`), which the desktop list already reads.

## Fix
`MobileProjectsPane.vue` reads `EMPTY`, `NO_MATCH` and `BIN_EMPTY` from `PROJECT_LIST_TEXT`.
Specs: `same-name-projects.browser.spec.ts`, `open-project-list.browser.spec.ts`, `project-bin.browser.spec.ts`.
