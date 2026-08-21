# ARCHITECTURE.md §5 sweep: four more calc-in-store / duplicated-formula violations beyond the known store.ts vent-area case

# Status
OPEN — V1 and V4 remain unfixed; V2 and V3 resolved.
- V1 (eg in syncedP): OPEN — `store.ts:448` still computes `Math.sqrt((state.P.Pin ?? 1) * (engineDriver()?.Re ?? 1))` inline.
- V2 (useDesignIO.ts PR re-derivation): RESOLVED — now calls `prCanonicalFromDatasheet()` (`useDesignIO.ts:270`), no local RHO/C literals.
- V3 (wprMapping.ts + OriginalShell.vue vent-area duplication): RESOLVED — `grep -rn "Math.PI \* (.*ventD" packages/ui/src` returns nothing.
- V4 (store.ts file-wide eslint-disable + window casts): OPEN — `store.ts:14` still has the file-scope `/* eslint-disable @typescript-eslint/no-explicit-any */`.

Scope note: the already-tracked `store.ts` `Sp`/`Leff` vent-area violation in `syncedP` is
**excluded** from this file — see the earlier report / commit in progress for that one. This is
a follow-up sweep for what that first pass didn't cover.

## V1 — `store.ts` computes drive voltage inline, same file, same rule, different line

`packages/ui/src/logic/store.ts:449`, inside `syncedP`:

```ts
// Drive voltage: sqrt(Pin × Re) — matches WinISD reference-power convention.
const eg = Math.sqrt((state.P.Pin ?? 1) * (driver.value?.Re ?? 1));
const p: SyncedParams = { ...state.P, eg };
```

Violates ARCHITECTURE.md §5 **"Only the domain objects calculate — the store never does"** — the
exact rule this file's own new header comment (lines 4–11) states in its own voice, three lines
above this. `eg` is derived from two state values (`Pin`, driver `Re`) via `sqrt(Pin × Re)`,
computed in `store.ts` itself.

**Fix**: add a getter — `ManagedOpenISDProject.driveVoltage_V()` or a method on `OpenISDDriver`
taking `Pin` — that performs this exact computation, and have `syncedP` read it:
```ts
const eg = managedProject.driveVoltage_V(state.P.Pin ?? 1);
```

## V2 — `useDesignIO.ts` re-derives PR canonical fields instead of calling the existing solver, and re-literals RHO/C

`packages/ui/src/logic/useDesignIO.ts:241–246`:

```ts
const prVasM3 = prVasLitres / 1000;
const RHO = 1.20095;
const C = 343.68;
const prCms = prVasM3 / (prSd * prSd * RHO * C * C);
const prMmd = prFs > 0 && prCms > 0 ? 1 / (4 * Math.PI * Math.PI * prFs * prFs * prCms) : 0.010;
const prRms = prQms > 0 && prCms > 0 ? Math.sqrt(prMmd / prCms) / prQms : 1.0;
```

This is the same formula, term for term, as `prCanonicalFromDatasheet()` in
`packages/ui/src/logic/prWinIsdFields.ts:80–88`:

```ts
const cms = vas / (sd * sd * RHO * C * C);
const mmd = 1 / ((2 * Math.PI * input.fsHz) ** 2 * cms);
const rms = Math.sqrt(mmd / cms) / input.qms;
```

`(2πf)² = 4π²f²`, so `prMmd`'s expression is algebraically identical to `mmd`'s. `prWinIsdFields.ts`
already imports `RHO`/`C` from `@openisd/engine` (line 11); `useDesignIO.ts` instead re-literals
truncated copies (`1.20095`, `343.68` vs the engine's `RHO`/`C` constants — precision mismatch is
an additional, separate risk on top of the duplication itself).

Violates ARCHITECTURE.md §5 **"Validated physics is moved, never re-derived"** and the
formula-duplication pattern the vent-area precedent already names.

**Fix**: replace the six lines above with:
```ts
const { cms: prCms, mmd: prMmd, rms: prRms } = prCanonicalFromDatasheet({
  sdCm2: prSd * 1e4, xmaxMm: prXmax * 1000, fsHz: prFs, qms: prQms, vasL: prVasLitres,
});
```
(adjusting the input unit conversions to match `prCanonicalFromDatasheet`'s documented
`sdCm2`/`xmaxMm`/`vasL` contract — `useDesignIO.ts`'s locals are apparently already in SI, so the
call site does the inverse conversion `prCanonicalFromDatasheet` itself undoes internally; verify
against the function's actual input contract before wiring this in literally.)

## V3 — vent cross-sectional area duplicated in two MORE places, on top of the known `store.ts` one

`@openisd/model`'s `ventArea_m2()` was written specifically to be the single source for this
formula (its own doc comment cites four prior duplicates). Two of the four are outside `store.ts`
and are NOT touched by the fix already in flight there:

**`packages/ui/src/logic/wprMapping.ts:42`**:
```ts
const Sp = Math.PI * (P.ventD / 2) ** 2;
```

**`packages/ui/src/ui/shells/original/OriginalShell.vue:143–147`**:
```ts
const ventArea = computed(() => {
  if (state.P.ventShape === 'slotted') {
    return state.P.ventW * state.P.ventH;
  }
  return Math.PI * (state.P.ventD / 2) ** 2;
});
```

The `.vue` case is a second full reimplementation of BOTH of `ventArea_m2`'s branches (slotted
and round), not just the round one.

**Fix**: both call sites should call `ventArea_m2(...)` on an `OpenISDVent`-shaped value built
from the relevant fields — same shape as the fix already planned for `store.ts`, i.e. through
whatever domain-object getter that fix lands (`managedProject.ventArea_m2()`), not by importing
`ventArea_m2` from `@openisd/model` directly into a `.vue` component or a mapping module. If
`wprMapping.ts` and `OriginalShell.vue` are UI-logic/component layer (not domain-object methods
themselves), they should read the getter the same way `store.ts`'s `Sp` will, once that lands —
not reimplement the arithmetic locally.

## V4 — `store.ts`'s new file-wide `eslint-disable` and unguarded `window as any`

`packages/ui/src/logic/store.ts:14` (pre-existing, not part of the current diff, but sits directly
under the new header comment declaring stricter discipline for this file):
```ts
/* eslint-disable @typescript-eslint/no-explicit-any */
```
and at lines ~360–362:
```ts
const globalCtx = (typeof window !== 'undefined') ? (window as any) : null;
if (!(window as any).__store_instances) (window as any).__store_instances = [];
```

Violates ARCHITECTURE.md §5 **"Strong typing over loose bags"** — a file-wide disable defeats the
type-checker for the entire module, not just the debug-hook lines that arguably need it. Lower
severity than V1–V3 (pre-existing, not introduced by today's diff), but the file's own new header
comment sets a stricter bar for itself than the rest of its content currently meets, worth fixing
in the same pass since the file is already being edited for the store-purity fix.

**Fix**: scope the disable to just the debug-hook block (`// eslint-disable-next-line` on each
`window as any` line, or a narrow local `interface WindowWithStoreDebug`), not the whole file.

## Not flagged — checked and clean

- No `Record<string, any>` anywhere in `packages/engine/src`, `packages/model/src`,
  `packages/winisd/src`, or `packages/ui/src`.
- No `window`/`document`/canvas reference in `packages/engine/src`, `packages/model/src`, or
  `packages/winisd/src` — "the core has no browser" holds.
- `packages/ui/src/logic/series.ts` — all `Math.*` calls are axis-range/log-scaling presentation
  logic over already-engine-computed sweep arrays; no acoustic maths or baseline subtraction.
- `useVentGroup.ts:113` / `usePrGroup.ts:59`'s `(P as unknown as Record<string, number>)[field]`
  casts are a generic dynamic-field-write pattern within an already-typed `UiParams`, not a
  loose-bag boundary — not reported as a genuine violation.

## Verification

- V1: `grep -n "Math.sqrt" packages/ui/src/logic/store.ts` returns nothing once `eg` is relocated.
- V2: `grep -n "1.20095\|343.68" packages/ui/src/logic/useDesignIO.ts` returns nothing; a diff
  against `prCanonicalFromDatasheet`'s existing test fixtures shows identical output for the same
  inputs (no formula-behavior change, pure relocation).
- V3: `grep -rn "Math.PI \* (.*ventD" packages/ui/src` returns only the (by-then-fixed)
  `@openisd/model` internals, not `wprMapping.ts` or any `.vue` file.
- V4: `grep -n "eslint-disable @typescript-eslint/no-explicit-any" packages/ui/src/logic/store.ts`
  returns nothing at file scope (top of file); any remaining occurrences are line-scoped.
