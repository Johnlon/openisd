# Plan: Direct FieldHandle Seams, Solver Write-Back, and UI Hook Layer Decoupling

## Objectives
1. **Direct Domain FieldHandle & Write-Back Seams**: Expose concrete `FieldHandle<number>` properties directly on domain component classes (`OpenISDDriver`, `Vent`, `VentedBox`, `PassiveRadiatorBox`, `Bandpass4Box`, `Bandpass6Box`, `AbcBox`) in `packages/design/domain/openisdDomain.ts` without `.fields()` maps or `.solverQuantities` getters. Provide direct `.solveConsistencyGroup()` seams that invoke `@openisd/engine` math and write calculated results directly back to non-Entered fields.
2. **Provenance & Persistence Invariants**:
   - **Entered ($E$) is Human-Locked**: Solver operations never touch or overwrite $E$ fields.
   - **Calculated ($C$) $\leftrightarrow$ Not-Set ($N$) are Solver-Managed**: Solver writes $C$ status values directly to non-$E$ fields, transitioning $N \rightarrow C$ when calculable or reverting $C \rightarrow N$ if inputs are missing.
   - **Persistence (`openisd.yml`) Invariant**: Only $E$ values are persisted to `openisd.yml`; $C$ fields auto-recalculate fresh on load.
3. **UI Hook Layer Decoupling**: Create dedicated `*-hooks.ts` presentation seams in `packages/ui/src/hooks/` for all interactive Vue components and shells in `@openisd/ui`, ensuring zero direct domain manipulation inside Vue templates/script blocks.

---

## 1. Domain Component FieldHandle & Solver Seam Architecture

| Domain Class | Direct FieldHandle Properties | Direct Solver Seam |
| --- | --- | --- |
| `OpenISDDriver` | `Fs_hz`, `Re_ohm`, `Qes`, `Qms`, `Qts`, `Vas_m3`, `Sd_m2`, `BL_Tm`, `Mms_kg`, `Cms_m_per_N`, `Rms_kg_per_s` | `solveConsistencyGroup()` |
| `Vent` / `VentWindow` | `tuning_hz`, `length_m`, `Vb_m3`, `area_m2`, `endCorrection_m` | `solveConsistencyGroup()` |
| `VentedBox` / `VentedBoxWindow` | `tuning_hz`, `length_m`, `Vb_m3`, `area_m2`, `endCorrection_m` | `solveConsistencyGroup()` |
| `PassiveRadiatorBox` | `tuning_hz`, `addedMass_kg`, `Vb_m3`, `prMmd_kg`, `prSd_m2`, `prCms_m_per_N`, `prNum` | `solveConsistencyGroup()` |
| `Bandpass4Box` | Front `tuning_hz`, `length_m`, `Vb_m3`, `area_m2` | `solveConsistencyGroup()` |
| `Bandpass6Box` | Rear & front `tuning_hz`, `length_m`, `Vb_m3`, `area_m2` | `solveConsistencyGroup()` |
| `AbcBox` | Rear, front, and intra port `tuning_hz`, `length_m`, `Vb_m3`, `area_m2` | `solveConsistencyGroup()` |

---

## 2. UI Hook Layer Decoupling Seams

### Existing Hooks
- `DriverEditorModal-hooks.ts`
- `GraphPanel-hooks.ts`
- `NumInput-hooks.ts`
- `OgTune-hooks.ts`

### New Hook Modules to Create in `packages/ui/src/hooks/`
- `AdvancedOptions-hooks.ts`: Manages Ql/Qa/Qp loss overrides and environment air parameters for `AdvancedOptions.vue`.
- `DiagnosticsModal-hooks.ts`: Manages selftest diagnostics and issue channel state for `DiagnosticsModal.vue`.
- `DriverBrowserWinisd-hooks.ts`: Manages driver library filtering, search, and selection for `DriverBrowserWinisd.vue`.
- `EquationInspectorModal-hooks.ts`: Manages formula equation selection and parameter inspection for `EquationInspectorModal.vue`.
- `OptionsModal-hooks.ts`: Manages app settings, unit preferences, and color scheme for `OptionsModal.vue`.
- `PRBrowser-hooks.ts`: Manages passive radiator library browsing and selection for `PRBrowser.vue`.
- `PREditModal-hooks.ts`: Manages passive radiator specification editing for `PREditModal.vue`.
- `OgEnclosure-hooks.ts`: Manages box volume, alignment buttons, and box type selection for `OgEnclosure.vue`.
- `OgFilters-hooks.ts`: Manages active filter additions, filter types, Q, and gain for `OgFilters.vue`.
- `OgNewProject-hooks.ts`: Manages new project wizard selections and template initialization for `OgNewProject.vue`.
- `OgProjectList-hooks.ts`: Manages project tabs, show/hide visibility, and project closing for `OgProjectList.vue`.
- `OgSignal-hooks.ts`: Manages drive level (voltage/power), impedance loading, and SPL target for `OgSignal.vue`.

---

## 3. Step-by-Step Execution Plan

1. **Domain Concrete Properties & Direct Write-Back**: Implement direct `FieldHandle<number>` concrete properties and `.solveConsistencyGroup()` direct write-back seams across domain classes in `packages/design/domain/openisdDomain.ts`.
2. **UI Hook Creation**: Implement the 12 new hook modules in `packages/ui/src/hooks/`.
3. **Vue Component Refactoring**: Update corresponding Vue components to delegate all reactive state and event actions to their respective `*-hooks.ts` modules.
4. **Verification**: Run targeted Vitest unit suites, run ESLint and `vue-tsc` typecheck, and execute `PROCEED=1 bash scripts/health-check.sh`.
