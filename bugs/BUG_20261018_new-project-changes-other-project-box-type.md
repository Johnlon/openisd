# BUG_20261018_new-project-changes-other-project-box-type

**Status:** NOT A BUG (T426): not an app defect. The review script chose the wrong select; the app is right. A spec now pins the app behaviour.

## Symptom
Six projects made through the phone New project wizard one after another: after "Sub" (Closed) was created, the earlier Vented project "Floorstander..." showed Box type Closed and turned Unsaved (QO247 review, picture 14).

## Evidence
- The review script (`lib.mjs` `makeProject`) picked the wizard's box type with `select:visible` and took the first one. With a project already open on its Box tab, the first visible select on the page is that project's own `#mob-box-type`, sitting behind the wizard, not the wizard's `#np-box-type`. The script set the open project's box type to Closed, which also made it Unsaved.
- Rerun with the wizard's own select (`#np-box-type`): the earlier Vented project stays Vented and saved, the new one is Closed.
- A user cannot tap the select behind the wizard overlay.

## Cause
Test script selector, not the app.

## Fix
No app change. `packages/ui/test/ui/mobile-new-project-keeps-other-box-type.browser.spec.ts` creates A (Vented) then B (Closed) through the phone wizard and checks A is still Vented and not Unsaved. Passes (it never failed: there is no app defect to fail on).
