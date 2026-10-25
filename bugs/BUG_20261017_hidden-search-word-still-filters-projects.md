# BUG_20261017_hidden-search-word-still-filters-projects

**Status:** FIXED (T271)

## Symptom
The Projects list offers a search box only when it holds more than 8 projects. Type a word, then
close or bin projects until 8 are left: the box goes away but its word still hides rows, and there is
nowhere to clear it. Both Projects pages.

## Cause
The list filtered by the typed word whether or not the box was shown.

## Fix
`shownProjects` (`packages/ui/src/hooks/projectBinView.ts`) uses the word only while the box is offered.
Spec: `projectBinView.test.ts`.
