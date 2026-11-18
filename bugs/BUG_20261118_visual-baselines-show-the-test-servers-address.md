# BUG_20261118_visual-baselines-show-the-test-servers-address

**Status:** FIXED (T896)

## Symptom
One sentence: the visual baseline pictures of the projects list show "Projects saved in this browser at http://localhost:4300/", an address no user ever sees.

## Cause
- The app is right. `packages/persistence/src/repos/projectRepo.ts:568` builds `Projects saved in this browser at ${storeAddress}`;
  `packages/ui/src/main.ts:266` passes `new URL('./', window.location.href).href`. Browser storage belongs to one address,
  so naming it tells a user where their projects are (and why projects on openisd.app are not on test.openisd.app).
- The test is wrong. `VisualSkin.start` in `packages/ui/test/visual/screens.ts` opened the page at the test server
  `http://localhost:4300/`, so every picture of the label drew that address (documented as an accepted part in
  `docs/design/VISUAL_BASELINES.md`; the Bin view and the phone projects pane both show the label).

## What a real user sees
- openisd.app: "Projects saved in this browser at https://openisd.app/"
- test.openisd.app: "Projects saved in this browser at https://test.openisd.app/"
- Never localhost, so the pictures were not what a user sees.

## Fix
- `VisualSkin.startOnReleaseSite` (used by every visual screen) loads the page at `https://openisd.app/`, with
  `standInForReleaseSite` answering every request under that address from the test server. The app is unchanged. No region is masked.
- The pictures that show the label need re-taking on CI (`bash scripts/visual/update.sh`).

## Tests
- `packages/persistence/test/projectRepo.test.ts` > "where the projects are kept" (label names the address it is handed).
- The visual suite itself: the label now reads `https://openisd.app/`.
