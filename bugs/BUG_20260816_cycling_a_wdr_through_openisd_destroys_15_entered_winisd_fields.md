# `KLe` is never computed

## Status
OPEN

## Symptom

WinISD derives `KLe`; openisd does not, so the value is lost on any cycle through the model.

`drivers/sample/winisd/John-all-manu-populated*.wdr` states:

    KLe = 49.6287078253544    (marked C — WinISD computed it)

A `.wdr` → `WinISDDriver` → `OpenISDDriver` → `WinISDDriver` → `.wdr` cycle returns `0`.

## Cause

No formula for `KLe` exists anywhere in `@openisd/engine`. The field has a home on the record and
survives as a stored value, but nothing derives it, so a record that does not state it explicitly
has no route to one.

## Fix

Recover WinISD's own `KLe` formula and add it to the engine's solver alongside the other derived
figures, guarded on its inputs being present, so a `C` value in a source file is reproduced rather
than zeroed.

## Verification

`packages/winisd/test/wdr-openisd-round-trip.test.ts`'s C-parity assertion covers `KLe` for
`John-all-manu-populated*.wdr`: the cycled value agrees with WinISD's stated
`49.6287078253544` within the file's own float precision.
