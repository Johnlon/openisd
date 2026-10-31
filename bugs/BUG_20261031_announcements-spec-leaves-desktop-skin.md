# announcements spec leaves a desktop skin choice on the shared test page (F58)

Found: 31 Oct 2026, F58 (suite red on main 20192e8fd, shard 8). Fixed on main the same day.

## What happened

`mobile-vented-tab.browser.spec.ts` failed on CI in its setup: `openAMobileProject` waited 20 s for
`.mobile-root input[type=file]`. The page snapshot showed the desktop shell on a 390 px window.

## Cause

`announcements.browser.spec.ts` runs on the worker's shared `appPage`. Its `start()` wrote
`openisd_view = {ui: {splashSeen: true, skinOverride: 'desktop'}}` straight into storage and reloaded.
That saved a skin choice the later specs never undo: `resetApp` does not reset the skin, and
`page.goto('/')` on the shared page does not reload, so `forceMobileSkin`'s init script never runs.
Every later mobile spec on that worker then sees the desktop shell. `'desktop'` is not even a valid
value (`skinOverride` is `'original' | 'mobile'`).

Reproduction: `bash scripts/test.sh packages/ui/test/ui/announcements.browser.spec.ts packages/ui/test/ui/mobile-vented-tab.browser.spec.ts --workers=1`
failed every time before the fix and passes after.

## Fix

- The announcements spec no longer sets a skin; the 1280 px window already gives the desktop shell.
- The app reads a saved skin choice through `parseSkinChoice` (presentationState.ts): only 'original'
  or 'mobile' is kept; anything else is dropped and the skin follows the window (John: "should have
  been rejected"). Unit test in `packages/ui/test/logic/viewSnapshot.test.ts`.
- Every test checks the skin before it runs (John: "each test suite should check the skin before
  running"): `resetApp` undoes a chosen skin with "Automatic view", as a user does, and checks the
  desktop shell a 1280 px window gives.

## Left open (after the release)

- The announcements spec writes app storage directly and reloads (rules: no backdoor, no reload).
