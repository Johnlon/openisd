/**
 * Enclosure-parameter precondition — the box-side counterpart to `sweep`'s own driver-side
 * precondition, `circuitQuantities` (CODE_REVIEW.md §18, ENGINE_HARDENING.md "Residual input
 * guards").
 *
 * `solve()` divides by these values without guarding, once per frequency:
 *   Cab = Vb/(ρc²)  then  cInv(Cab)      circuit.ts — sealed, vented, pr, bandpass4
 *   Cabf = Vf/(ρc²) then  cInv(Cabf)     circuit.ts — bandpass4 front chamber
 *   Map = ρ·Leff/Sp                      circuit.ts — vented + bandpass4 port branch
 *   Cap = prCms·prSd², Map = Mmd/prSd²   circuit.ts — passive radiator
 *
 * A zero or absent value therefore yields `Infinity`/`NaN` at EVERY frequency. The sweep
 * postcondition (`classifyFinite`) does catch that, but it can only say "no usable values"
 * — it cannot know WHICH field caused it. Validating the inputs here names the field, so
 * the message points at the box volume the user actually has to change.
 *
 * Communicated through the `{ values, issues }` result every other node solve now uses (T9) —
 * no throw (.claude/rules/openisd-result-contract.md).
 *
 * This is input validation only: it changes no formula and no computed number.
 */

import type {BoxType, EnclosureParams, SweepParams} from './types.js';
import type {CalculationIssue} from './consistency.js';
import {NumberField} from '../fields/field.js';

export type BoxParamsQuantityName = keyof EnclosureParams;
export type BoxParamsIssue = CalculationIssue<BoxParamsQuantityName>;

/** `solveBoxParams`'s one result: the enclosure parameters unchanged (`values`) when every
 *  field the circuit divides by is present, or `null` with `issues` naming what is missing. */
export interface BoxParamsSolveResult {
  readonly values: EnclosureParams | null;
  readonly issues: readonly BoxParamsIssue[];
}

/** One enclosure parameter `solve()` divides by, with the human wording for its message. */
interface RequiredParam {
  /** The `SweepParams` key — also the `DriverError.field`, so the UI can point at the input. */
  readonly field: keyof EnclosureParams;
  /** How the field is named to a human, matching the UI's own label. */
  readonly label: string;
  /** What goes wrong in the circuit when it is absent or non-positive. */
  readonly consequence: string;
}


/**
 * Which parameters `box`'s circuit actually divides by, and why — the one table `solveBoxParams()`
 * reads. Lives INSIDE the function that
 * builds it, not at module scope: a module-scoped `const` object is shared mutable state
 * however it is declared, because `const` freezes the binding and not the contents
 * (packages/design/AGENTS.md).
 *
 * A TOTAL map over `BoxType` (../AGENTS.md §"A CLOSED SET IS AN ENUM"): giving the
 * circuit a new topology is a compile error here rather than a silent hole in the precondition.
 * `Sp` is required for `bandpass4` as well as `vented` — the bandpass front chamber calls the
 * same `portImpedance()` (circuit.ts), so it divides by `Sp` identically.
 */
export function requiredParamsFor(box: BoxType): readonly RequiredParam[] {
  const VB: RequiredParam = {
    field: 'Vb',
    label: 'Box volume (Vb)',
    consequence: 'the box compliance Cab = Vb/(ρc²) collapses to zero, which makes the enclosure impedance infinite at every frequency',
  };

  const VF: RequiredParam = {
    field: 'Vf',
    label: 'Front chamber volume (Vf)',
    consequence: 'this box has two chambers, and the front one needs a volume before the response can be drawn',
  };

  const SP: RequiredParam = {
    field: 'Sp',
    label: 'Vent area (Sp)',
    consequence: 'the port mass Map = ρ·Leff/Sp is infinite — enter a vent diameter',
  };

  const PR_SD: RequiredParam = {
    field: 'prSd',
    label: 'Passive-radiator piston area (prSd)',
    consequence: 'every PR element is referred to the acoustic domain through prSd², so the whole PR branch is undefined',
  };

  const PR_CMS: RequiredParam = {
    field: 'prCms',
    label: 'Passive-radiator compliance (prCms)',
    consequence: 'the PR acoustic compliance Cap = prCms·prSd² collapses to zero, giving it infinite impedance',
  };

  const PR_MMD: RequiredParam = {
    field: 'prMmd',
    label: 'Passive-radiator moving mass (prMmd)',
    consequence: 'a massless radiator has no resonance, so there is nothing for the box to tune against',
  };

  const REQUIRED_BY_BOX: Record<BoxType, readonly RequiredParam[]> = {
    sealed:                 [VB],
    vented:                 [VB, SP],
    'box-passive-radiator': [VB, PR_SD, PR_CMS, PR_MMD],
    bandpass4:              [VB, VF, SP],
    // `Bandpass6Box`/`AbcBox` never call `port.ts`'s `portImpedance()` (their port masses come
    // from `Fr`/`Ff`, not from `Sp`/`Leff` geometry — `SweepParams.Spr`'s own doc), so unlike
    // `bandpass4`'s front chamber neither needs `Sp` here: only the two chamber volumes are a
    // genuine divide-by-zero (`Cabr = Vb/(ρc²)`, `Cabf = Vf/(ρc²)`, both denominators elsewhere).
    bandpass6:              [VB, VF],
    abc:                    [VB, VF],
  };

  return REQUIRED_BY_BOX[box];
}


/** A sweep setting the circuit cannot run with: the air, the drive level, the counts, the series
 *  resistance, the frequency grid, the losses and tunings the box reads directly. */
export type SweepSettingName =
  | 'rho' | 'c' | 'eg' | 'nDrivers' | 'Rs' | 'fmin' | 'fmax' | 'prNum' | 'prMadd'
  | 'Fb' | 'Fr' | 'Ff' | 'Qlr' | 'Qar' | 'Qpr' | 'Qiclfr' | 'Qlf' | 'Qaf' | 'Qpf' | 'SpIntra' | 'LeffIntra';
export type SweepSettingIssue = CalculationIssue<SweepSettingName>;

/** `solveSweepSettings`'s one result: `values` is the sweep's parameters unchanged when every rule
 *  holds, else `null` with `issues` naming each value broken and what it must be. */
export interface SweepSettingsSolveResult {
  readonly values: SweepParams | null;
  readonly issues: readonly SweepSettingIssue[];
}

/** One sweep setting's rule (`SimulationEngine.solveSweepSettings` checks each): where it applies,
 *  the value it reads, whether that value is usable, and the sentence the person reads. `read`
 *  gives null where the setting is absent: that is a fault only where `required`; elsewhere absent
 *  keeps the engine's own default. */
export interface SweepSettingRule {
  readonly field: SweepSettingName;
  readonly boxes: readonly BoxType[];
  readonly read: (P: SweepParams) => number | null;
  readonly required: boolean;
  readonly usable: (v: number) => boolean;
  readonly text: string;
}

/** Every rule `SimulationEngine.solveSweepSettings` checks. Each is a value no design can use: one
 *  that gives NaN or Infinity at every frequency (bugs/BUG_20261118_input-limits-sweep.md). */
export function sweepSettingRules(): readonly SweepSettingRule[] {
  const ALL: readonly BoxType[] = ['sealed', 'vented', 'box-passive-radiator', 'bandpass4', 'bandpass6', 'abc'];
  const TWO_CHAMBER: readonly BoxType[] = ['bandpass4', 'bandpass6', 'abc'];
  const VENTED_REAR: readonly BoxType[] = ['bandpass6', 'abc'];
  const PR: readonly BoxType[] = ['box-passive-radiator'];
  const positive = (v: number) => Number.isFinite(v) && v > 0;
  const atLeast = (min: number) => (v: number) => Number.isFinite(v) && v >= min;
  const given = (v: number | undefined): number | null => v ?? null;
  const fGrid = NumberField.PLOT_FMIN_HZ.limits.min;
  const loss = (field: SweepSettingName, read: (P: SweepParams) => number | undefined, boxes: readonly BoxType[], label: string): SweepSettingRule => ({
    field, boxes, read: P => given(read(P)), required: false, usable: positive,
    text: `${label} must be greater than zero: a zero or negative Q makes a zero or infinite resistance inside the box.`,
  });
  const tuning = (field: SweepSettingName, read: (P: SweepParams) => number | undefined, boxes: readonly BoxType[], label: string): SweepSettingRule => ({
    field, boxes, read: P => given(read(P)), required: false, usable: positive,
    text: `${label} must be greater than zero: a port tuned to 0 Hz or below has no finite length, so the box has no response.`,
  });
  return [
    {field: 'rho', boxes: ALL, read: P => P.air.rho(), required: false, usable: positive,
      text: 'Air density must be greater than zero: air with no density carries no sound.'},
    {field: 'c', boxes: ALL, read: P => P.air.c(), required: false, usable: positive,
      text: 'Sound velocity must be greater than zero: the box compliance Vb/(ρc²) is infinite without it.'},
    {field: 'eg', boxes: ALL, read: P => P.eg, required: false, usable: positive,
      text: 'Drive voltage must be greater than zero: the driver is not driven.'},
    {field: 'nDrivers', boxes: ALL, read: P => given(P.nDrivers), required: false, usable: atLeast(1),
      text: `${NumberField.DRIVER_NDRIVERS.label} must be at least 1.`},
    {field: 'Rs', boxes: ALL, read: P => given(P.Rs), required: false, usable: atLeast(0),
      text: `${NumberField.SIGNAL_RS_OHM.label} must not be negative: a negative resistance is not a wire.`},
    {field: 'fmin', boxes: ALL, read: P => given(P.fmin), required: false, usable: atLeast(fGrid),
      text: `${NumberField.PLOT_FMIN_HZ.label} must be at least ${fGrid} Hz.`},
    {field: 'fmax', boxes: ALL, read: P => given(P.fmax), required: false, usable: atLeast(fGrid),
      text: `${NumberField.PLOT_FMAX_HZ.label} must be at least ${fGrid} Hz.`},
    {field: 'prNum', boxes: PR, read: P => given(P.prNum), required: false, usable: atLeast(1),
      text: `${NumberField.PR_NUM.label} must be at least 1.`},
    {field: 'prMadd', boxes: PR, read: P => given(P.prMadd), required: false, usable: atLeast(0),
      text: `${NumberField.PR_MADD_G.label} must not be negative: a negative mass makes the radiator's mass negative.`},
    tuning('Fb', P => P.Fb, ['vented'], 'Vent tuning (Fb)'),
    tuning('Ff', P => P.Ff, TWO_CHAMBER, 'Front chamber tuning (Ffc)'),
    tuning('Fr', P => P.Fr, VENTED_REAR, 'Rear chamber tuning (Frc)'),
    loss('Qlr', P => P.Qlr, TWO_CHAMBER, 'Leakage Ql (rear chamber)'),
    loss('Qar', P => P.Qar, TWO_CHAMBER, 'Absorption Qa (rear chamber)'),
    loss('Qpr', P => P.Qpr, VENTED_REAR, 'Port Qp (rear chamber)'),
    loss('Qiclfr', P => P.Qiclfr, TWO_CHAMBER, 'Interchamber Qicl'),
    loss('Qlf', P => P.Qlf, TWO_CHAMBER, 'Leakage Ql (front chamber)'),
    loss('Qaf', P => P.Qaf, TWO_CHAMBER, 'Absorption Qa (front chamber)'),
    loss('Qpf', P => P.Qpf, TWO_CHAMBER, 'Port Qp (front chamber)'),
    // ABC's intra port has no tuning to solve its mass from: Mai = ρ·LeffIntra/SpIntra (`AbcBox`).
    {field: 'SpIntra', boxes: ['abc'], read: P => given(P.SpIntra), required: true, usable: positive,
      text: 'Intra port cross area must be greater than zero: its mass ρ·Leff/Sp is infinite. Enter its diameter, or its slot width and height.'},
    {field: 'LeffIntra', boxes: ['abc'], read: P => given(P.LeffIntra), required: true, usable: positive,
      text: 'Intra port length must be stated: the intra port has no mass ρ·Leff/Sp to sweep with. Enter its length.'},
  ];
}
