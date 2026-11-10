---
description: Layout rules for number boxes and dropdowns — one component, nothing clipped, aligned, same size
paths:
  - "packages/ui/**"
---

# Field layout rules — cast in stone

John, 5 Nov 2026 (QO426): "make sure these rules are cast in stone for future changes". They apply the
same way to every screen and every box type, on both skins. Any change under `packages/ui` that draws
a number box, a count or any dropdown must keep them.

Gate: [`packages/ui/test/ui/field-layout-rules.browser.spec.ts`](../../packages/ui/test/ui/field-layout-rules.browser.spec.ts)
walks every screen at 374 x 705 (phone) and 1280 x 720 (desktop) and asserts rules 2 to 7. A fault not
yet fixed is a `test.fails` naming its bug file; there are no exemptions. Rule 1 is covered by the
architecture gate `packages/ui/test/architecture/no-numinput-outside-uifieldbody.test.ts`.
The rules, word for word from the gallery (`ui-gallery/T690-common-field/RULES.md`):

1. **One component.** Every number box and count dropdown is drawn by the common field.
2. **Nothing clipped.** No text, box, button or panel edge is cut off. A scrollbar is better than clipping, and neither should happen at these sizes.
3. **Same left edges.** In a group, every label starts at one x, and every value starts at one x.
4. **Same width.** In a group, every value has one width and one right edge. Nothing is wider or narrower than its neighbours.
5. **Same height.** In a group, every dropdown has one height and every number box has one height.
6. **Same rows.** Rows in columns side by side sit at the same y, when they hold the same thing.
7. **No overlap.** Nothing sits on top of anything else.
8. **Nothing else moves.** A screen with none of these faults stays as it is.
9. **Checked twice.** A script measures rules 2 to 7, then a second model looks at every picture. A picture that fails is fixed before you see it.
10. **A gap before the buttons.** On the phone, a number box (its unit chip included) ends at least `PhoneRowColumns.MIN_STEPPER_GAP_PX` (4 px) before its up/down buttons. John, 10 Nov 2026: "there is no gap between the cell and the spinner buttons".
11. **A value is never cut.** The text in a number box, and its unit, fit inside it, for the longest figure the screen shows (a calculated 0.36872, 8 characters). `packages/ui/test/ui/phone-long-values-fit.browser.spec.ts` types the long figure; the gate reads every shown one (R11).

Coverage: every component that draws a common field is listed in `packages/ui/test/fixtures/fieldLayoutSurfaces.ts` and mapped to a screen the gate opens (or a bug file); `architecture/field-layout-surfaces.test.ts` fails on a new screen or popup that is not.
