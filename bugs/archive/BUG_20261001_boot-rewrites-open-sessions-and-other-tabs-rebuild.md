# BUG_20261001_boot-rewrites-open-sessions-and-other-tabs-rebuild

**Status:** FIXED 2026-10-01

## Symptom
Opening OpenISD in a new tab makes every other open tab rebuild all of its projects, for
nothing. The cost grows with the number of open projects. Under load it is long enough to make
`tabs-share-one-session.browser.spec.ts` "a display unit chosen in one tab shows in the other"
time out on a click in the first tab (1 run in 3 to 8 when alone; in the pre-push run).

## Cause
[App.vue](http://localhost:8000/winisd/openisd/packages/ui/src/ui/App.vue#L87-L89) `onMounted`
saves the open sessions it has just read. Reading a project gives its embedded driver a fresh id,
so the saved text differs from the stored text, the browser raises a storage event in every
other tab, and each one adopts the session and rebuilds every project.

Measured (2026-10-01): opening a second tab sends the first exactly one `openisd_open_sessions`
storage event; nothing echoes back.

## Fix
A boot save of an unchanged session writes nothing.

## Fixed (part), 2026-10-01
`projectRepo.saveOpenProjects` writes nothing when the stored session states the same projects
(`OpenISDProject.sameOwprText`: equal apart from the embedded driver's per-read `uuid`). Measured:
a third tab now sends the others no event. Test: `projectRepair.test.ts` "saving the session it
just read".

## Fixed (rest), 2026-10-01
The first reader still rewrote the record once after a file import: the importing tab gave the
project its trace colour as an unsaved edit, and the reader's boot (`markProjectSaved`) committed
it, so the reader's text differed. `OpenISDProject.stampTraceColor` now writes the colour into the
saved record (and any edits), so it is never an unsaved change. Measured: opening a second tab
sends the first no storage event. Tests: `project-trace-color.test.ts`, `sessionSync.test.ts`
"a project imported in one tab"; `tabs-share-one-session.browser.spec.ts` 4/4.
