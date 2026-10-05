# BUG_20261005_project-selection-lost-on-reload

**Status:** FIXED 2026-10-05

## Symptom
John: "if I unselect certain projects then refresh, they all reselect." A project whose
show-on-graphs checkbox was unticked (desktop Projects list, mobile menu) came back ticked after
a page reload, in both skins.

## Cause
The show/hide state lived only in memory (`traceVisibility.ts`), and the open-project session
saved on every change stored each project's record but not whether its trace was hidden.

## Fix
- [projectRepo.ts](http://localhost:8000/winisd/openisd/packages/persistence/src/repos/projectRepo.ts):
  each open-session entry stores `traceHidden`; `saveOpenProjects` takes the hidden set and
  `loadOpenProjects` returns it. A session saved before this has no flag and restores every
  trace shown. A project that no longer reads is dropped with its flag.
- [sessionSync.ts](http://localhost:8000/winisd/openisd/packages/ui/src/logic/sessionSync.ts)
  saves the session when a trace is shown or hidden; `restoreProjects` (boot and another tab's
  session) applies the stored flags. A project opened later is shown.
- Trace colour was already restored: it is saved in the project record.

## Verification
- [projectRepo.test.ts](http://localhost:8000/winisd/openisd/packages/persistence/test/projectRepo.test.ts):
  hidden set round-trips; a visibility-only change is written; an old session restores all shown.
- [sessionSync.test.ts](http://localhost:8000/winisd/openisd/packages/ui/test/logic/sessionSync.test.ts),
  [boot.test.ts](http://localhost:8000/winisd/openisd/packages/ui/test/logic/boot.test.ts).
- Browser, one per skin:
  [original-project-list.browser.spec.ts](http://localhost:8000/winisd/openisd/packages/ui/test/ui/original-project-list.browser.spec.ts),
  [mobile-project-list.browser.spec.ts](http://localhost:8000/winisd/openisd/packages/ui/test/ui/mobile-project-list.browser.spec.ts):
  hide one of two projects, reload, its box is still unticked and the chart draws only the shown trace.
