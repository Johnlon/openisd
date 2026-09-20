## Goal Description
Refactor the domain-to-engine solver seam to operate *directly* on domain field accessors via `SolverField`, eliminating intermediate dictionaries, hand-rolled mapping tuple arrays, and double-fixpoint solves.

## User Review Required
> [!IMPORTANT]
> - **Zero UI Scope**: UI code is completely untouched. Only `packages/design/domain`, `packages/design/engine`, and domain unit tests are modified.
> - **No Loops/Dictionaries**: The engine reads from and writes to the domain strictly through the direct `DriverSolverParams` interface. No tuples or arrays are built to map these back.
> - **Batch Notifications Restored**: `OpenISDDriver.solveConsistencyGroup()` delegates directly while wrapping the call in `this.batchNotifications(() => { ... })` to defer UI updates.

## Proposed Changes

### Engine Layer (`packages/design/engine`)
#### [NEW] `packages/design/engine/solverTypes.ts`
Declare the solver interface contract for a single field so it structurally matches the domain's `Field<T>` natively:
Crucially, **the Engine becomes the owner of the C/N/E state type**. Since the physics solver is the arbiter of provenance (protecting 'entered', deriving 'calculated', and declaring 'not-available'), it natively defines the state type rather than borrowing it from the legacy WinISD serialization layer.

```ts
export type FieldState = 'entered' | 'calculated' | 'not-available';

export interface SolverField<T = number> {
  /** Read the current value. */
  readonly value: T | null;
  
  /** True if the user explicitly entered this value ('E'). The solver must NEVER overwrite an entered value. */
  readonly entered: boolean;
  
  /** True if the value was derived by the physics engine ('C'). */
  readonly calculated: boolean;
  
  /** True if the value cannot be derived from current inputs ('N'). */
  readonly notAvailable: boolean;
  
  /** Write a derived value, marking the field as 'calculated' ('C'), and optionally attach DQ. */
  setCalculated(value: T, dq?: string[]): void;
  
  /** Attach a Data Quality (DQ) issue to an *entered* field. */
  setDq(dq?: string[]): void;
  
  /** Mark a field as un-derivable ('N' / not-available). */
  setNotAvailable(): void;
}
```

#### [MODIFY] `packages/design/engine/solver.ts`
Completely eliminate the `SolverQuantities` dictionary wrapper and `checkConsistency` double-pass. The physics solver takes a direct positional parameter list and reads/writes to the handles natively:
```ts
export function solveConsistencyGroup(
  Fs_hz: SolverField,
  Re_ohm: SolverField,
  Qes: SolverField,
  Qms: SolverField,
  Qts: SolverField,
  Vas_m3: SolverField,
  Sd_m2: SolverField,
  BL_Tm: SolverField,
  Mms_kg: SolverField,
  Cms_m_per_N: SolverField,
  Rms_kg_per_s: SolverField,
  numVC: SolverField,
  VCCon: SolverField<'series' | 'parallel'>
): void {
  // Example: Direct native math execution reading field properties
  if (Qes.value !== null && Qms.value !== null) {
    const expectedQts = (Qes.value * Qms.value) / (Qes.value + Qms.value);

    if (!Qts.entered) {
      // Derive missing value
      Qts.setCalculated(expectedQts);
    } else {
      // Validate entered value for DQ
      const diff = Math.abs(Qts.value - expectedQts);
      if (diff > 0.01) {
        Qts.setDq([`Qts should be ${expectedQts.toFixed(3)} based on Qes and Qms`]);
      } else {
        Qts.setDq();
      }
    }
  } else if (!Qts.entered) {
    Qts.setNotAvailable();
  }

  // Example 2: Reading VCCon (which is strongly typed to 'series' | 'parallel')
  if (Re_ohm.value !== null && VCCon.value !== null) {
    // In practice, this would write to a Re_terminal_ohm field if it were part of the parameters
    const coilCount = numVC.value ?? 1;
    const terminalRe = VCCon.value === 'series' ? Re_ohm.value * coilCount : Re_ohm.value / coilCount;
    // ...
  }

  // All other physics formulas follow this exact pattern directly using the parameter handles.
}
```

### Domain Layer (`packages/design/domain`)
#### [MODIFY] `packages/design/domain/cell.ts`
1. **Remove Legacy Dependency**: Remove the dependency on `../winisd/index.js` for `CellState`. Instead, import `FieldState` directly from `packages/design/engine/solverTypes.ts` so the engine strictly owns provenance state.
2. **Strict Identity on Snapshot**: Add `readonly name: string` to the `Cell<T>` interface and the `createCell` factory function. Every snapshot will now strictly identify which field it belongs to.
3. **Structurally Satisfy `SolverField<T>`**: `Field<T>` will implement `SolverField<T>` directly so it can be passed to the engine.
4. **Convenience vs UI Getters**: `Field<T>` will expose `get name(): string { return this.readCell().name; }` and `get entered(): boolean { return this.state === 'entered'; }` specifically to satisfy the solver logic natively, while retaining `get state(): FieldState` for the UI to render proper styling and tooltips.

```ts
import type { FieldState, SolverField } from '../engine/solverTypes.js';

export class Field<T> implements SolverField<T> {
  constructor(
    private readonly readCell: () => Cell<T>,
    // ... existing constructor args
  ) {}

  // Name is now pulled directly from the underlying cell snapshot
  get name(): string { return this.readCell().name; }
  
  get value(): T | null { return this.readCell().value; }
  
  // The UI needs the full C/N/E state to render styles/tooltips
  get state(): FieldState { return this.readCell().state; }
  
  // Convenience boolean accessors for provenance state
  get entered(): boolean { return this.state === 'entered'; }
  get calculated(): boolean { return this.state === 'calculated'; }
  get notAvailable(): boolean { return this.state === 'not-available'; }
  
  setCalculated(value: T, dq?: string[]): void {
    // Write-back logic handled natively by the domain
  }
  
  setDq(dq?: string[]): void {
    // Write-back logic handled natively by the domain
  }
  
  setNotAvailable(): void {
    this.clearValue();
  }
  
  // ... existing methods (get, set)
}
```

#### [MODIFY] `packages/design/domain/openisdDomain.ts`
Pass the fields as a flat parameter list to the engine solver natively, requiring an adapter ONLY for `VCCon` (to bridge the enum value to a literal).

```ts
function toReadonlySolverField<T, U = T>(
  handle: Field<T>,
  mapValue: (val: T | null) => U | null = (v) => v as unknown as U | null
): SolverField<U> {
  return {
    get value() { return mapValue(handle.value); },
    get entered() { return handle.entered; },
    get calculated() { return handle.calculated; },
    get notAvailable() { return handle.notAvailable; },
    setCalculated: () => { throw new Error(`Solver attempted to calculate read-only field: ${handle.name}`); },
    setDq: () => { throw new Error(`Solver attempted to set DQ on read-only field: ${handle.name}`); },
    setNotAvailable: () => { throw new Error(`Solver attempted to clear read-only field: ${handle.name}`); },
  };
}
```

Wrap the engine delegation in `batchNotifications` to properly defer UI updates while the solver completes its write-back pass:

```ts
    solveConsistencyGroup(): void {
        this.batchNotifications(() => {
            const spec = this.spec[this.section];
            this.engine.solveConsistencyGroup(
                spec.Fs_hz,
                spec.Re_ohm,
                spec.Qes,
                spec.Qms,
                spec.Qts,
                spec.Vas_m3,
                spec.Sd_m2,
                spec.BL_Tm,
                spec.Mms_kg,
                spec.Cms_m_per_N,
                spec.Rms_kg_per_s,
                spec.numVC,
                toReadonlySolverField(
                  spec.VCCon,
                  val => val === VoiceCoilWiring.Series ? 'series' : 'parallel'
                )
            );
        });
    }
```

## Verification Plan
### Automated Tests
```bash
npm run test:unit
```
