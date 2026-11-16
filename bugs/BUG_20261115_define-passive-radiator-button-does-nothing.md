# BUG_20261115_define-passive-radiator-button-does-nothing

**Status:** FIXED in T840 (issue Johnlon/openisd#522, John 2026-11-16: "it is a bad bug"). Reproduced: the button silently replaced the project's radiator with a blank one. Now it opens an editor (see Fix).

## Symptom
John, 15 Nov 2026 23:57 UTC: "the define passive radiator button on the pr popup doesn't work at all".

## Steps to reproduce (what I ran, headless Chromium via Playwright, fresh context per run)
1. Open https://test.openisd.app/ (build v20261115T2349Z) and https://openisd.app/ (build v20261108T0032Z), read only. Phone 390x844 (isMobile, touch) and desktop 1440x900.
2. New project, driver PTT6.5X04-NFA-06 (vented). Phone: Box tab, Box type select -> Passive Radiator. Desktop: Box type select -> "Passive Radiator", then project nav item "Passive Radiator".
3. Press "Select PR" (phone) / "Select passive radiator" (desktop). The "Passive radiator library" popup opens.
4. Press "+ Define new passive radiator".
Also run: (B) load bundled ASP190 first, then Define; (C) load ASP190, reload the page, reopen popup, Define (tap on phone); (W) New Project wizard, PR step, Select passive radiator, Define.

## Expected
A new passive radiator is defined and the user can fill it in.

## Actual (same on every combination; no console errors, no page errors, no native dialog, no page reload; only a stats-worker request failed)
- Popup closes (overlay count 1 -> 0). The project's PR is replaced by a blank one: every PR field empty (name, Vas, Fpr, Sd, Mms, Cms, Rms, Xmax), Fp/Fh show a dash.
- Desktop: the SPL chart is replaced by "Can't plot SPL response ... Fix the listed inputs" and PR boxes go red. Phone: blank fields with warning triangles.
- Wizard: popup closes, PR step fields blank. Nothing receives focus, and nothing says a new radiator was started. When the PR was already blank the only visible change is the popup closing.
Both skins x test and production: same. Screenshots (all viewed) in /tmp/claude-1000/-home-johnl-work-winisd/51219a74-a6a4-4cb0-bd5f-341e33efe862/scratchpad/prbug/ : {test,prod}-{390x844,1440x900}-{A,B}-{popup,after-define}.png, test-*-C-*.png, test-*-W*.png.

## Evidence / Cause
- Button: packages/ui/src/ui/components/PRBrowser.vue:73 emits 'define'. Wired at OriginalShell.vue:842-843 and MobileEnclosureTab.vue:71-72 to defineNewPREntry (hooks/passiveRadiatorActions.ts:40-43), which calls appState.definePassiveRadiator() (logic/appState.ts:779-782: configurePR(OpenISDPassiveRadiatorStandalone.empty())) and closes the popup. Wizard: OriginalNewProject-hooks.ts:476-481.
- Design: the code says there is no separate editor ("a blank one rather than a form of its own", appState.ts:775-778), so Define = "wipe the radiator, close the popup". That is the likely reason it reads as "does nothing / doesn't work": no form opens, no confirmation, no name focus, and the previous PR is discarded silently. This is an inference, not confirmed with John.
- Not a recent regression: the handler chain dates from 4a25164f (2026-09-29) and b97903bb (2026-10-12); no commit since touches it. Production (older build) behaves identically.
- Ruled out: handler not wired, console/page errors, dialog behind another, touch vs mouse (tap used on phone), state after reload, wizard path.
- Not tried: John's actual device/browser, a project with saved cloud state, a screen reader. If John's device really does nothing (popup stays), that is a different bug and needs his browser and steps.

## Tests that should have caught it
No browser spec presses Define on the main-screen PR popup. Existing: test/hooks/passiveRadiatorActions.test.ts:37 (mocked dependency, no DOM), test/logic/newProject.test.ts:92-123 (appState only), mobile-pr-library-buttons.browser.spec.ts and phone-classic-rows.browser.spec.ts (Define is only checked to be on screen), wizard specs (wizard only, new-project-wizard.browser.spec.ts:49).

## Failing test (written first)
packages/ui/test/ui/pr-define.browser.spec.ts (desktop, phone, wizard step). Run on portingle/main, 7 of 7 fail: the setup (load ASP190, open the popup, press Define) passes, then `getByRole('dialog', {name: 'Define new passive radiator'})` never appears (no editor exists).

## Fix
John, 2026-11-16 (QO946.c37): "make it work like the driver editor". Define opens PRDefineDialog: a new, blank radiator, its name box focused, the eight intrinsic figures. OK (needs a name) files it in My passive radiators and leaves the project's radiator alone, as "Add new driver" does for My Drivers; picking it from the popup's Saved list is what uses it. Cancel, Esc and a click outside keep nothing. Intrinsic/user split (QO946.c38): the editor holds only the radiator's own figures; count, tuning and added mass stay on the project's box and are never written to the radiator record (checked: they live on the box, not on OpenISDPassiveRadiator). The old project/wizard "define" wiring is gone (appState.definePassiveRadiator and the wizard's defineNewPassiveRadiator remain, used only by unit tests; remove with #524).

## Verification
pr-define.browser.spec.ts (desktop, phone, wizard step) fails 7 of 7 on portingle/main (no editor appears), passes now.

## Follow-up (16 Nov 2026, QO946.c115-c120)
John asked for one passive-radiator editor with the driver's Select / Info / Edit workflow. Define now opens that editor
(PREditorDialog, replacing PRDefineDialog); its OK makes the new radiator the project's (or the wizard's) and Copy to My PRs
files it in the library. Plan: docs/plans/PLAN_20261116_PASSIVE_RADIATOR_EDITOR.md. Specs: pr-define.browser.spec.ts,
pr-editor.browser.spec.ts.
