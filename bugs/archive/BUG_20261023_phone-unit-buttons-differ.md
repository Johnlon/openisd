# BUG_20261023_phone-unit-buttons-differ

**Status:** FIXED (T572)

## Symptom
John, 23 Oct 2026: "we have inconsistent button designed on mobile the units on box are grey and while on other pages". On the phone the unit button next to a number looked different on different screens. The Box tab's "Choose alignment" sheets (sealed and vented) drew the unit (L, Hz) as plain grey text with no chip; the Box page rows, the Driver tab and the Graph sheets drew it as a grey chip with an edge on its left.

## Survey (374x705, phone skin, before the fix)
| Page | Rotating units | Fixed units |
|---|---|---|
| Box page, all six types | chip (#efefef, bold 600, #444, 1px left edge, 34 px tall) | plain grey (#888, 400) |
| Driver tab | chip | plain grey |
| Signal tab | none | plain grey |
| Filters tab | none | plain grey |
| Box alignment sheets | plain grey text, 20 px tall, no fill (the bug) | plain grey |

## Cause
Three hand-made unit classes (`ui-field-unit`, `mob-sheet-unit`, `mob-unit`) each drew the chip in their own CSS: the rows on the classic page in `style.css`, the Graph sheets in `MobileSheet.vue`. The alignment sheets sit outside the classic page, so the vented sheet got the old plain rule and the sealed sheet's own `mob-unit` rule (grey text, no fill).

## Decision: which style
One look for every unit, rotating or fixed: the grey chip of the Box page (the majority style). The
accepted classic mock (ui-gallery/QO267/CONTROLS.md) drew fixed units (Ω, m/s, W, V) as plain grey text;
John's words above say the plain ones read as a different design, so they get the chip too. A unit
that rotates keeps its dotted underline, the cue that it can be tapped. maryu, 23 Oct 2026; John can
undo it on the before/after page (ui-gallery/unit-buttons/).

## Fix
`UnitToggle.vue` (the one component behind every unit label) draws the phone chip for every unit
inside the phone root, fixed or rotating (`span.unit-label`, one element more specific than a caller's
scoped unit class, so it wins in any load order). The duplicate looks were removed from `style.css`
(including its dotted underline on every unit) and `MobileSheet.vue`; `MobileBoxTab.vue`'s `.mob-unit`
only places the unit. The desktop skin is not inside the phone root and is unchanged.

## Verification
`bash scripts/test.sh packages/ui/test/ui/mobile-unit-buttons.browser.spec.ts` reads the computed fill, colour, edge, size and weight of the unit on the Box page, the Driver tab, both Box alignment sheets and the Signal tab's fixed units and requires them equal (fixed units without the underline). `packages/ui/test/architecture/phone-unit-chip-owned-by-unittoggle.test.ts` fails if a phone shell or phone rule in style.css draws a unit look of its own.
