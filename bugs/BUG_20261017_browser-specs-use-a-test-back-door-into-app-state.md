# BUG_20261017_browser-specs-use-a-test-back-door-into-app-state

**Status:** OPEN

## Symptom
John, 17 Oct 2026: "no backdoor in UI testing". On the live state objects: "evil". The browser specs read and change the app's live `appState` and `presentationState`, which a user cannot do.

## What is allowed (John, 17 Oct 2026)
- A browser spec acts only as a user does: the UI, files a user imports, and storage the app itself wrote.
- A check on live data reads the screen, what the user sees. Saved records are inspected only when saving is the thing under test.
- The scripted update host stands in for a service worker, an outside system. It may stay.

## Evidence
There are two things, the app and the browser specs. The app publishes `appState` and `presentationState` on `globalThis` in the test build (`packages/ui/src/logic/testHooks.ts`), and the specs use them (`fixtures.ts` 34 places, `focusedProjectSeam.ts`, `mobileSkin.ts`, `app-reset-isolation`, `consistency-dq`, `mobile-chart-axis-drag`, `mobile-num-stepper`). We need every spec to do the same through the UI or a real file import, and the hook for state removed.

## Fix
Plan to fable first (touches many specs), then one task per fixture group. Anything the UI cannot do is an app finding.

## Verification
`git grep -n "openisdTestHooks\|TEST_HOOKS_KEY" packages/ui` lists only the update host.
