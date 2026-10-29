# BUG_20261025_round-to-slot-leaves-dimensions-empty-and-length-stale

**Status:** RESOLVED in T580.

## Symptoms

When a round vent was changed to a slotted vent, Slot width, Slot height and Vent length became empty. Entering 1 cm for width and height did not update Vent length until another edit event occurred.

## Expected

Changing to a slot fills whole-centimetre dimensions whose area is approximately the current round port area. Editing either slot dimension updates the solved vent length immediately.

## Fix

The vent domain chooses the closest whole-centimetre rectangular dimensions. Port field updates run through the owning project so vent calculations and dependent fields resolve in the same edit.

## Verification

`packages/design/test/domain/box-vent-geometry.test.ts` pins the integer dimensions; `packages/ui/test/ui/mobile-sheet-port.browser.spec.ts` verifies round-to-slot conversion and immediate length recalculation.
