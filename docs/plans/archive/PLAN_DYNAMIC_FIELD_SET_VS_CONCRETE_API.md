# Implementation Plan: Dynamic Field Set vs. Concrete API Refactoring

## Goal Description
Refactor domain entities in `@openisd/design` (`OpenISDDriver`, `Vent`, `PassiveRadiatorBox`) to remove legacy `.fields()` dynamic dictionary getters and establish a clean, interface-driven solver seam with collated Data Quality (`dq`) issues and single canonical reset verb `setNotAvailable()`.

## User Review Required
> [!IMPORTANT]
> **Interface-Driven Solver Seam & DQ Collation**:
> - Solver operates directly on domain field accessors via `SolverField` (`get()`, `isEntered()`, `setCalculated(value, dq)`, `setNotAvailable()`).
> - Single canonical reset verb is `setNotAvailable()`. `clear()` and `setNotSet()` are eliminated.
> - Data Quality (`dq`) on field cells supports a **collation of multiple issues** (`readonly string[]`), collating all consistency and physical limit warnings that touch each field during the solver pass.
> - Eliminates all caller dictionary packing/unpacking and eliminates hand-coded mapping arrays in the domain layer.

## Open Questions
- None. Invariants are specified in [`docs/design/DYNAMIC_FIELD_SET_VS_CONCRETE_API.md`](../../design/DYNAMIC_FIELD_SET_VS_CONCRETE_API.md).

---

## Detailed Execution Task List

| Task ID | Task Description | Target File | Verification Gate |
| --- | --- | --- | --- |
| **TASK-1** | Declare `SolverField` & `DriverConsistencyTarget` in `@openisd/engine` and implement `solveDriverConsistency(target)` combining derivation and DQ collation | `packages/design/engine/solverTypes.ts`, `packages/design/engine/solver.ts` | `npx vitest run packages/design/test/engine/solver.test.ts` |
| **TASK-2** | Update `Cell<T>`, `FieldHandle<T>`, and `Field<T>` in `@openisd/design` to implement `SolverField` (`dq(): readonly string[]`, `setNotAvailable()`, `isEntered()`, `setCalculated()`) | `packages/design/domain/cell.ts` | `npx vitest run packages/design/test/domain.test.ts` |
| **TASK-3** | Refactor `OpenISDDriver.solveConsistencyGroup()` to delegate directly to `engine.solveDriverConsistency(this.spec[this.section])` | `packages/design/domain/openisdDomain.ts` | `npx vitest run packages/design/test/domain.test.ts` |
| **TASK-4** | Update persistence bridge in `openIsdDriverToWinIsdDriver` to call `driver.solveConsistencyGroup()` | `packages/design/domain/driverYmlToOpenisdAndWdr.ts` | `npx vitest run packages/design/test/winisd/driverYmlToOpenisdAndWdr.test.ts` |
| **TASK-5** | Update architecture specification tests to verify `driver.spec[driver.section]` field handles | `packages/design/test/architecture-spec-section-is-numeric.test.ts` | `npx vitest run packages/design/test/architecture-spec-section-is-numeric.test.ts` |
| **TASK-6** | Update UI and test call sites from `clear()` to `setNotAvailable()` | `packages/ui/`, `packages/design/test/` | `npm run test:unit` |
| **TASK-7** | Quality Gates & Compilation | Repo root | `npm run lint && npm run typecheck` |
| **TASK-8** | Unit Test Suite & Health Check | Repo root | `npm run test:unit && PROCEED=1 bash scripts/health-check.sh` |

---

## Proposed Code Specifications

### Component 1: Engine Solver Interface (`@openisd/engine`)

#### [MODIFY] `packages/design/engine/solverTypes.ts`

```ts
export interface SolverField {
  get(): number | undefined;
  isEntered(): boolean;
  setCalculated(value: number, dq?: readonly string[]): void;
  setNotAvailable(): void;
}

export interface DriverConsistencyTarget {
  readonly Fs_hz: SolverField;
  readonly Re_ohm: SolverField;
  readonly Qes: SolverField;
  readonly Qms: SolverField;
  readonly Qts: SolverField;
  readonly Vas_m3: SolverField;
  readonly Sd_m2: SolverField;
  readonly BL_Tm: SolverField;
  readonly Mms_kg: SolverField;
  readonly Cms_m_per_N: SolverField;
  readonly Rms_kg_per_s: SolverField;
  readonly numVC: SolverField;
  readonly VCCon: SolverField;
}
```

---

### Component 2: Domain Cell Contract (`@openisd/design`)

#### [MODIFY] `packages/design/domain/cell.ts`

```ts
export interface Cell<T> {
  readonly value: T | null;
  readonly state: CellState;
  /** Collation of all data-quality issues affecting this cell */
  dq(): readonly string[];
}

export interface FieldHandle<T> {
  get(): Cell<T>;
  set(v: T): void;
  setNotAvailable(): void;
}
```

---

### Component 3: Domain Driver Seam (`@openisd/design`)

#### [MODIFY] `packages/design/domain/openisdDomain.ts`

```ts
export abstract class OpenISDDriver extends OpenISDDevice {
  solveConsistencyGroup(): void {
    this.batchNotifications(() => {
      this.engine.solveDriverConsistency(this.spec[this.section]);
    });
  }

  solveDriverConsistencyGroup(): void {
    this.solveConsistencyGroup();
  }
}
```

---

## Verification Plan

### Automated Tests
```bash
# 1. Engine & Domain tests
npx vitest run packages/design/test/engine/solver.test.ts
npx vitest run packages/design/test/domain.test.ts
npx vitest run packages/design/test/architecture-spec-section-is-numeric.test.ts

# 2. Quality gates
npm run lint
npm run typecheck

# 3. Full unit suite
npm run test:unit
```

### Manual Verification
1. `npm run build`
2. `bash scripts/preview-4000.sh`
3. `curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/`
