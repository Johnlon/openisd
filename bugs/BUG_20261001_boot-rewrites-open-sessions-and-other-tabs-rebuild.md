# BUG_20261001_boot-rewrites-open-sessions-and-other-tabs-rebuild

**Status:** OPEN

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

## Still open
The first tab to READ a session written by another tab still rewrites it once, because the read
changes content, not only the id: it stamps `saved.charts.traceColor`, and it writes `edited` as
null where the writing tab held an edited state. That one rewrite makes the writing tab rebuild
its projects once. Fix: the writing tab stores the same form a reader produces.
