# `enterPrDatasheet` takes LITRES for Vas while every other parameter is SI

**Where:** `packages/model/src/openisdProject.ts:1159`, re-declared on the managed facade at
`packages/ui/src/logic/managedProject.ts:561`.

**Status:** OPEN — recorded 2026-08-28, not fixed. Changing a domain API signature is John's call.

## Symptom

The passive-radiator datasheet entry point mixes unit spaces in one object literal:

```ts
enterPrDatasheet(d: { vasL: number; fsHz: number; qms: number; sdM2: number; xmaxM?: number }): void
```

`sdM2` is square metres, `xmaxM` is metres, `fsHz` is hertz — all SI. `vasL` is **litres**.

## Evidence

The parameter name states it (`vasL`), and the sole caller supplies a litre value. The domain's
own setter beside it is SI (`setPrVas_m3`), so the same quantity has an SI setter and a
non-SI datasheet parameter on the same object.

## Why it matters

The project rule is SI everywhere inside, conversion only at parse-in and display-out
(`bugs/BUG_20260819...si.md`, and the OuterX/OuterY record at `8a1aeb0`). A non-SI parameter in
a domain API pushes a conversion back OUT into every caller — exactly the hand-rolled-conversion
class QO82 exists to eliminate. A caller that forgets the ×1000 is off by a factor of 1000 with
nothing to catch it: the value is dimensionally plausible either way.

## Cause

Not established. The `vasL` spelling predates the Lane-P4a work that made the PR datasheet
vocabulary the domain's keyed surface; whether litres was deliberate (mirroring WinISD's own
datasheet pane, which prints litres) or an oversight is not determined here.

## Fix (proposed, NOT applied)

Rename the parameter to `vasM3` and take cubic metres, converting at the one call site through
`fromDisplay(v, 'volume', 'L')` like every other display→SI boundary. One caller, one test
surface.

## Verification

Not applicable — unfixed. Current call sites route the litre conversion through
`units.ts`'s `toDisplay`, so no hand-rolled factor exists in the view; the API asymmetry itself
remains.
