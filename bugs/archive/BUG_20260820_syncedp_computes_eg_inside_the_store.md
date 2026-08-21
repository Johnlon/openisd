Status: FIXED

# `syncedP` computes drive voltage inside `store.ts`, which its own header forbids

## Symptom

`packages/ui/src/logic/store.ts:485`:

```ts
const eg = Math.sqrt((state.P.Pin ?? 1) * (engineDriver()?.Re ?? 1));
```

A physical quantity — drive voltage from input power and voice-coil resistance — calculated in
the storage layer.

## Evidence

`store.ts:4-12`, the file's own header, states the rule it is breaking:

> It must never CALCULATE a value — not even by correctly calling out to a properly
> single-sourced formula function. A calculated value is a property or method on the domain
> object that owns it (`OpenISDDriver`/`ManagedOpenISDProject`), read by this file, never
> computed IN this file. If a value this file needs isn't exposed on the owning domain object
> yet, the fix is adding it there as a getter/method — never computing it here "just this
> once," however small or well-sourced the calculation looks.

That header records John's ruling of 2026-08-18. The `eg` line is the exact case it describes,
in the file that describes it — including the "just this once" escape it pre-emptively refuses.

Independently: `ARCHITECTURE.md`'s module-responsibility table gives `logic` "May not contain:
Maths", and the dependency rules state maths may only live in `@openisd/engine`.

## Cause

The value was needed and no getter existed on the owning domain object, so it was computed
locally — precisely the path the header forbids.

## Fix

`ManagedOpenISDProject.driveVoltage_V()` (`packages/ui/src/logic/managedProject.ts`) — reads
`this.inputPower_W()` and the effective driver's `Re`, and calls `@openisd/engine`'s
`driveVoltage(pin, re)` (`packages/engine/src/formulas.ts`), the SAME formula `store.ts` used to
inline. `syncedP` (`store.ts`) now reads `managedProject.driveVoltage_V()` — no arithmetic in
the store.

## Verification

`grep -n 'Math\.' packages/ui/src/logic/store.ts` finds no arithmetic on a physical quantity.
`syncedP.eg` is exercised indirectly by every sweep-driving test (`store-filters-reactivity.test.ts`
et al.) and by `sweep()`'s own consumers, unchanged in value from before the fix.
