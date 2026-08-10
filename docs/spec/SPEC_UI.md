# OpenISD — User Interface & Charting Specification (`SPEC_UI.md`)

This specification defines the user interface presentation requirements, chart mapping contracts, and state behavior implemented by `@openisd/ui` (`packages/ui/src/`).

---

## 1. Chart Presentation & Series Mapping

### 1.1 Decoupled Chart Series Building

- **Decoupling Rule**: `packages/ui/src/utils/series.ts` is strictly a presentation adapter. It performs NO electro-acoustic calculations or baseline subtraction math. It receives pre-computed data arrays (`sw.tfMag`, `sw.spl`, `sw.exc`, `sw.gd`) from `@openisd/engine` and formats them into renderer series (`Series[]`).
- **Transfer Function Magnitude Chart**:
  - Primary series: `sw.tfMag` from engine (0 dB = high-frequency passband asymptote).
  - Reference lines: $0\text{ dB}$ (dashed grey) and $-3\text{ dB}$ (dashed orange).

**Verifying Tests**:

- [`packages/ui/test/chart-types.test.ts`](../../packages/ui/test/chart-types.test.ts)

---

## 2. Driver Editor & Parameter State Cascade

### 2.1 E/C/N State Color Marks

- **Entered (E)**: Value entered by the user (green mark).
- **Calculated (C)**: Value derived by the consistency solver (blue mark).
- **Not specified (N)**: Value unentered / uncalculated (black mark).

**Verifying Tests**:

- [`packages/ui/test/driver-type-chips.test.ts`](../../packages/ui/test/driver-type-chips.test.ts)
- [`packages/ui/test/driver-editor-solver.browser.spec.ts`](../../packages/ui/test/driver-editor-solver.browser.spec.ts)
