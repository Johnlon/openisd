# BUG_20261018_phone-equation-inspector-covers-editor-tabs

**Status:** FIXED — T418

## Symptom
On the phone (374x705), in the driver editor with Inspect Provenance ticked, tapping a field opens the Provenance card at the top right. The card covers the editor's Close ✕ and the Advanced and Dimensions tabs. The user cannot switch tabs or close the editor until they close the card.

## Evidence
- UI gallery run 20261018T190243Z_4bf2ec77, screen `phone-equation-inspector` (after/phone-equation-inspector.png): the "Provenance: Qts" card sits over the dialog header and the tab row.
- Desktop (`desktop-equation-inspector.png`) has room beside the dialog, so nothing is covered.

## Cause
`packages/ui/src/ui/components/EquationInspectorModal.vue` `.eq-inspector-card` is `position: fixed`, 380 px wide (max `100vw - 40px`), z-index 10050, above the editor dialog. At phone width it spans almost the whole screen. ⚠ The rule that puts it at the top on the phone (its CSS says bottom: 20px) is not traced yet.

## Fix
On the phone, the card must not cover the editor's header, tabs or footer buttons: for example, dock it as a bottom sheet in the editor body, or open it inline under the field. Layout choice goes through the shared phone sheet components (no one-off sizes).

## Verification
Gallery screen `phone-equation-inspector`: the editor's Close ✕ and all four tabs are visible and tappable while the card is open. A browser spec taps the Advanced tab with the card open and sees the Advanced tab.

## Fixed
Fixed in T470 (driver-editor-phone-fixes.browser.spec.ts). Before/after: ui-gallery/fixes-20261019/driver-editor/. On the phone the card docks over the lower half of the editor body.
