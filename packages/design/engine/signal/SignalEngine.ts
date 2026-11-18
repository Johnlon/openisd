/**
 * The signal area — the drive power shared by N drivers and the voltage each driver gets, related
 * through the driver's DC resistance: `power_W = N · voltage_V² / Re_ohm` (WinISD: each driver is
 * fed P/N; winisd_research runs/nd-1).
 *
 * With a usable Re, whichever of the two is entered fixes the other, written as calculated.
 * Without one, the power is not available (the issue names Re) and the voltage keeps what it
 * holds — a voltage is always present, so a sweep always has one.
 */

import {missingDependencies} from '../consistency.js';
import {NumberField} from '../../fields/field.js';
import type {CalculationIssue} from '../consistency.js';
import type {SignalSolverParams} from '../solverTypes.js';
import type {DriverWiring} from '../array/driverWiring.js';
import {DEFAULT_DRIVER_WIRING, amplifierVoltage, driverDrive} from '../array/driverWiring.js';

export type SignalQuantityName = keyof SignalSolverParams;
export type SignalIssue = CalculationIssue<SignalQuantityName>;

const usable = (v: number | null): v is number => v !== null && Number.isFinite(v) && v > 0;

/** The lowest drive voltage a sweep runs at: 10 mV, the Driver input voltage box's own minimum. */
const MIN_DRIVE_VOLTAGE_V = NumberField.SIGNAL_DRIVEV_V.limits.min;

const POWER_FORMULA = 'power_W = nDrivers · voltage_V² / Re_ohm';
const POWER_INPUTS: readonly SignalQuantityName[] = Object.freeze(['voltage_V', 'Re_ohm'] as const);

/**
 * Drive voltage from reference (system) power, voice-coil resistance, and series resistance:
 * V = √(Pin · (Re + Rs)).
 * Matches WinISD's reference-power convention where input power is total power into (Re + Rs).
 */
export function driveVoltage(pin: number, re: number, rs: number = 0): number {
  return Math.sqrt(pin * (re + (rs > 0 ? rs : 0)));
}

/**
 * Reference power from drive voltage, voice-coil resistance, and series resistance — the inverse of `driveVoltage`:
 * P = V² / (Re + Rs).
 */
export function driveFromVoltage(eg: number, re: number, rs: number = 0): number {
  const r = re + (rs > 0 ? rs : 0);
  return r > 0 ? (eg * eg) / r : 0;
}

/** The signal area of the engine: the drive voltage and drive power, related through the
 *  driver's DC resistance, and the handle solve between them. */
export interface SignalEngine {
  /** The voltage that delivers `pin` watts into `re` (+ `rs`) ohms. */
  driveVoltage(pin: number, re: number, rs?: number): number;
  /** The amplifier's output voltage that delivers `pin_W` into `n` drivers of `re` ohms wired `wiring` through source resistance `rs`
   *  (placed as `rgAtDriverSide` says). */
  amplifierVoltageFor(pin_W: number, n: number, wiring: DriverWiring, re: number, rs: number, rgAtDriverSide: boolean): number;
  /** With a usable Re: an entered V writes P = N·V²/Re as calculated, otherwise P writes
   *  V = √(P/N·Re) as calculated. Without Re: P not available, with the issue naming Re. */
  solve(p: SignalSolverParams): readonly SignalIssue[];
  /** The drive level no sweep runs at, read before `solve`: an entered voltage below 10 mV, or an
   *  entered power that is not above 0 W or drives below 10 mV. Each issue names the entered box. */
  driveLevelIssues(p: SignalSolverParams): readonly SignalIssue[];
}

export class SignalEngineImpl implements SignalEngine {
  readonly driveVoltage = driveVoltage;

  amplifierVoltageFor(pin_W: number, n: number, wiring: DriverWiring, re: number, rs: number, rgAtDriverSide: boolean): number {
    const drive = driverDrive(n, wiring, 1, rs, rgAtDriverSide);
    return amplifierVoltage(n, wiring, driveVoltage(pin_W / n, re, drive.Rg_ohm));
  }

  driveLevelIssues(p: SignalSolverParams): readonly SignalIssue[] {
    const refused = (target: SignalQuantityName, text: string): readonly SignalIssue[] =>
      [{ kind: 'result-refused', target, fields: [target], text }];
    if (p.voltage_V.entered) {
      const V = p.voltage_V.value;
      return V >= MIN_DRIVE_VOLTAGE_V ? [] : refused('voltage_V',
        `Driver input voltage ${V} V is below the ${MIN_DRIVE_VOLTAGE_V} V minimum, so the charts are not drawn: enter at least ${MIN_DRIVE_VOLTAGE_V} V.`);
    }
    const power_W = p.power_W.value;
    if (!p.power_W.entered || power_W === null) return [];
    if (!usable(power_W)) {
      return refused('power_W', `System input power ${power_W} W is not above 0 W, so the charts are not drawn: enter a power above 0 W.`);
    }
    const Re_ohm = p.Re_ohm.value;
    if (!usable(Re_ohm)) return [];
    const nDrivers = p.nDrivers?.value ?? null;
    const V = this.amplifierVoltageFor(power_W, usable(nDrivers) ? nDrivers : 1, p.driverWiring ?? DEFAULT_DRIVER_WIRING,
      Re_ohm, p.Rs_ohm?.value ?? 0, p.rgAtDriverSide !== false);
    return V >= MIN_DRIVE_VOLTAGE_V ? [] : refused('power_W',
      `System input power ${power_W} W drives below the ${MIN_DRIVE_VOLTAGE_V} V minimum voltage, so the charts are not drawn: enter a larger power.`);
  }

  solve(p: SignalSolverParams): readonly SignalIssue[] {
    const Re_ohm = p.Re_ohm.value;
    const Rs_ohm = p.Rs_ohm?.value ?? 0;
    const nDrivers = p.nDrivers?.value ?? null;
    const n = usable(nDrivers) ? nDrivers : 1;
    if (usable(Re_ohm)) {
      // `voltage_V` is the amplifier's voltage: each driver gets `drive.eg_V` through `drive.Rg_ohm`. Absent wiring is Parallel.
      const wiring = p.driverWiring ?? DEFAULT_DRIVER_WIRING;
      const drive = driverDrive(n, wiring, p.voltage_V.value, Rs_ohm, p.rgAtDriverSide !== false);
      if (p.voltage_V.entered) {
        p.power_W.setCalculated(n * driveFromVoltage(drive.eg_V, Re_ohm, drive.Rg_ohm));
        return [];
      }
      const power_W = p.power_W.value;
      if (usable(power_W)) {
        p.voltage_V.setCalculated(this.amplifierVoltageFor(power_W, n, wiring, Re_ohm, Rs_ohm, p.rgAtDriverSide !== false));
        return [];
      }
    }
    p.power_W.setNotAvailable();
    return [missingDependencies('power_W',
      [{ formula: POWER_FORMULA, required: POWER_INPUTS, missing: usable(Re_ohm) ? ['voltage_V'] : ['Re_ohm'] }])];
  }
}
