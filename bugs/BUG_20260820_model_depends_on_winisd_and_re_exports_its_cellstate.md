Status: OPEN — docs fixed 2026-08-21; CellState question remains

# `openisdDriver.ts` and `ARCHITECTURE.md` both state the model↔winisd dependency BACKWARDS

## Symptom

`@openisd/model` depends on `@openisd/winisd` at runtime. That direction is CORRECT and
intended (John's ruling 2026-08-21: "oid points at WinIsd, not the other way" — `toWinISDDriver()`
belongs on `OpenISDDriver`). The defect is that the file's own header and `ARCHITECTURE.md` both
assert the OPPOSITE, so the documentation contradicts the code and would mislead anyone
reasoning about the boundary.

Secondary, and a separate question: `CellState` — the provenance enum the whole app reads — is
WinISD's type, re-exported under OpenISD's name.

## Evidence

`packages/model/src/openisdDriver.ts:35-38`:

```ts
import { WinISDDriver, INI_ROWS } from '@openisd/winisd';   // runtime VALUES
export { CellState } from '@openisd/winisd';                 // re-EXPORT
import { CellState } from '@openisd/winisd';
import type { WdrCell, WdrHeader } from '@openisd/winisd';
```

`packages/model/package.json:18` lists `"@openisd/winisd": "*"` under **dependencies**, not
devDependencies — a runtime edge, not a type-only one.

The reverse direction is clean: `packages/winisd/src` imports nothing from `@openisd/model`
(only `DriverError` from `@openisd/engine`), and holds `@openisd/model` as a devDependency for
tests alone. So WinISD does not know OpenISD exists — the coupling is entirely one-way, from
the model onto the format.

**The file's own header contradicts this**, `openisdDriver.ts:8-11`:

> `.wdr`/`.wpr` do not appear here. WinISD is a CONSUMER of our files and a reference oracle,
> not our model — everything about that format (ParState, the 49 slots, the 48-key order,
> VCCon's 1/2 encoding) lives behind the serialisers in `@openisd/winisd`, **which depends on
> this package and is invisible from here.**

Both claims are false as written: `@openisd/winisd` does NOT depend on `@openisd/model`, and it
is not invisible from here — four of its exports are imported on the lines immediately below
that comment.

`ARCHITECTURE.md:566` states the same wrong direction, so the documentation and the code
disagree with reality in the same way.

## Cause

Not established. `CellState` (entered / calculated / absent) is a provenance concept OpenISD
needs regardless of whether WinISD exists; it appears to have been defined in the WinISD package
because ParState is where the three-state distinction was first modelled, and the model then
imported it rather than declaring its own.

`WinISDDriver`/`INI_ROWS`/`WdrCell`/`WdrHeader` are imported for `toWinISDDriver()`, which is the
`.wdr` projection — the direction QO55 is already reshaping.

## Fix

**RULED (John, 2026-08-21): the dependency direction stays as it is — `OpenISDDriver` points at
WinISD; WinISD must never point back.** `toWinISDDriver()` remains on `OpenISDDriver`. No code
moves.

What must change is the documentation that contradicts it:

1. DONE 2026-08-21 — `openisdDriver.ts` header now states the real direction: the model projects
   itself into WinISD's format, `@openisd/model` imports `@openisd/winisd` and never the reverse.
2. DONE 2026-08-21 — `ARCHITECTURE.md`'s dependency table: the `@openisd/model` row names both
   its dependencies; the `@openisd/winisd` row now reads "depends only on `@openisd/engine`. It
   imports NOTHING from `@openisd/model` and must never learn OpenISD exists."
3. DONE 2026-08-21 — the stale `fromOpenISDDriver` reference is gone, along with every other
   mention of OpenISD in `packages/winisd/src`: `grep -c "OpenISDDriver\|@openisd/model"
   packages/winisd/src/winisdDriver.ts` returns 0. Verified: `tsc -p packages/winisd`,
   `tsc -p packages/model` clean; `vitest run packages/winisd/test packages/model/test`
   1297 passed.

**Still open, separate question:** `CellState` is declared in `@openisd/winisd` and re-exported
by `@openisd/model` (`openisdDriver.ts:36`), so every consumer reading provenance from the model
transitively depends on the format package. Under the ruled direction that is not a layering
breach, but it does mean OpenISD's own entered/calculated/absent concept is owned by the WinISD
package. Needs a decision: leave it, or declare it in `@openisd/model` and have WinISD import it.

## Verification

N/A — open. Afterwards: no comment or doc in the repo claims `@openisd/winisd` depends on
`@openisd/model`, and `packages/winisd/src` still imports nothing from it.
