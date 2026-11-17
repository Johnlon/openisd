# BUG_20261116_coil-wiring-refuses-three-or-more-coils

**Status:** FIXED in PR #137 (T838), 2026-11-16

## Symptom
`convertWiring` refused a driver with 3 or more voice coils ("only 2 coils"), so a 3 or 4 coil driver could not be
wired differently from its measured wiring. WinISD's routine converts for any coil count above 1.

## Ruling
John, QO942.c64: "it must work for all counts, OpenISD has a bug therefore".

## Fix
Coil wiring converts for any N of 2 or more: Re, Le and Znom by N squared and BL by N (all coils series against all
parallel). Test: `packages/design/test/engine/wiring-conversion.test.ts` (N = 2, 3, 4, and the Re-and-BL-only switch).
