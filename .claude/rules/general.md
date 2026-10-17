# General rules — always

John, 16–17 Oct 2026.

## Work

1. **Never work around an unexpected issue.** A leak, flake, hang or odd failure is a bug: find
   where it comes from and fix it there. No reset, retry, skip, fallback or mask that makes it go
   away. If the cause is in the app, it gets a `bugs/` file and a failing test first.
2. **No backdoor in UI testing.** A browser spec acts only as a user does: the screen, the
   controls, and files a user imports. It never reads or changes the app's live state objects,
   and the app has no test-only way in.
   - A check on live data reads the screen.
   - A spec reads the saved records only when saving is what it tests.
   - A scripted stand-in for an outside system the test can't control (for example the browser's
     service worker) is allowed.
3. **Never reload during a test unless the test is about reload.** No reload between tests and
   none mid-test as a reset. A value carried into the next test is an app bug (rule 1).

## App

4. **Every button shows a visible result.** Nothing the app does happens silently. A download,
   export or save shows a popup or another clear result that says what was done (for example
   "Exported 12 projects to openisd-projects.zip"). A silent button is a bug.
