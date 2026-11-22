/**
 * The signal area — the drive power shared by N drivers and the voltage each driver gets, related
 * through the driver's DC resistance: `power_W = N · voltage_V² / Re_ohm` (WinISD: each driver is
 * fed P/N; winisd_research runs/nd-1).
 *
 * With a usable Re, whichever of the two is entered fixes the other, written as calculated.
 * Without one, the power is not available (the issue names Re) and the voltage keeps what it
 * holds — a voltage is always present, so a sweep always has one.
 */

import {invalidValue, missingDependencies, outsideNormalBand} from '../consistency.js';
import type {CalculationIssue, DqIssue} from '../consistency.js';
import {NumberField} from '../../fields/field.js';
import type {SignalSolverParams} from '../solverTypes.js';
import type {DriverWiring} from '../array/driverWiring.js';
import {DEFAULT_DRIVER_WIRING, amplifierVoltage, driverDrive, eachOfN} from '../array/driverWiring.js';

import {isobarikDriveResistance, type IsobarikSettings} from '../solvers/isobarikWiring.js';

export type SignalQuantityName = keyof SignalSolverParams;
export type SignalIssue = CalculationIssue<SignalQuantityName>;

const usable = (v: number | null): v is number => v !== null && Number.isFinite(v) && v > 0;

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
  isobarikDriveResistance(re: number | null, settings: IsobarikSettings): number | null;
  /** The voltage that delivers `pin` watts into `re` (+ `rs`) ohms. */
  driveVoltage(pin: number, re: number, rs?: number): number;
  /** The amplifier's output voltage that delivers `pin_W` into `n` drivers of `re` ohms wired `wiring` through source resistance `rs`
   *  (placed as `rgAtDriverSide` says). */
  amplifierVoltageFor(pin_W: number, n: number, wiring: DriverWiring, re: number, rs: number, rgAtDriverSide: boolean): number;
  /** With a usable Re: an entered V writes P = N·V²/Re as calculated, otherwise P writes
   *  V = √(P/N·Re) as calculated. Without Re: P not available, with the issue naming Re. */
  solve(p: SignalSolverParams): readonly SignalIssue[];
  /** The system power `n` drivers wired `wiring` draw when the amplifier gives `voltage_V` through
   *  source resistance `rs` (placed as `rgAtDriverSide` says): the inverse of `amplifierVoltageFor`. */
  powerFor(voltage_V: number, n: number, wiring: DriverWiring, re: number, rs: number, rgAtDriverSide: boolean): number;
  /** The marks a stated Driver input voltage earns, and nothing else: not a positive number is `invalid-value`;
   *  positive below the box's 10 mV minimum is `outside-normal-band`. The value is kept and shown as stated. */
  driveVoltageIssues(voltage_V: number): readonly DqIssue[];
  /** The marks a stated System input power earns: zero, negative or not finite is `invalid-value`; a positive power whose
   *  amplifier voltage `voltage_V` is below the 10 mV minimum is `outside-normal-band`. */
  drivePowerIssues(power_W: number, voltage_V: number | null): readonly DqIssue[];
}

export class SignalEngineImpl implements SignalEngine {
  readonly driveVoltage = driveVoltage;
  readonly isobarikDriveResistance = isobarikDriveResistance;

  amplifierVoltageFor(pin_W: number, n: number, wiring: DriverWiring, re: number, rs: number, rgAtDriverSide: boolean): number {
    const drive = driverDrive(n, wiring, 1, rs, rgAtDriverSide);
    return amplifierVoltage(n, wiring, driveVoltage(eachOfN(pin_W, n), re, drive.Rg_ohm));
  }

  powerFor(voltage_V: number, n: number, wiring: DriverWiring, re: number, rs: number, rgAtDriverSide: boolean): number {
    const drive = driverDrive(n, wiring, voltage_V, rs, rgAtDriverSide);
    return n * driveFromVoltage(drive.eg_V, re, drive.Rg_ohm);
  }

  driveVoltageIssues(voltage_V: number): readonly DqIssue[] {
    const field = NumberField.SIGNAL_DRIVEV_V;
    if (!(Number.isFinite(voltage_V) && voltage_V > 0)) return [invalidValue(voltage_V)];
    if (voltage_V < field.limits.min) return [outsideNormalBand(field.value, lowDriveText(field, voltage_V))];
    return [];
  }

  drivePowerIssues(power_W: number, voltage_V: number | null): readonly DqIssue[] {
    const field = NumberField.SIGNAL_PIN_W;
    if (!(Number.isFinite(power_W) && power_W > 0)) return [invalidValue(power_W)];
    if (voltage_V !== null && voltage_V < NumberField.SIGNAL_DRIVEV_V.limits.min) {
      return [outsideNormalBand(field.value, lowDriveText(field, power_W))];
    }
    return [];
  }

  solve(p: SignalSolverParams): readonly SignalIssue[] {
    const Re_ohm = p.Re_ohm.value;
    const Rs_ohm = p.Rs_ohm?.value ?? 0;
    const nDrivers = p.nDrivers?.value ?? null;
    const n = usable(nDrivers) ? nDrivers : 1;
    if (usable(Re_ohm)) {
      // `voltage_V` is the amplifier's voltage: each driver gets `drive.eg_V` through `drive.Rg_ohm`. Absent wiring is Parallel.
      const wiring = p.driverWiring ?? DEFAULT_DRIVER_WIRING;
      if (p.voltage_V.entered) {
        p.power_W.setCalculated(this.powerFor(p.voltage_V.value, n, wiring, Re_ohm, Rs_ohm, p.rgAtDriverSide !== false));
        return [];
      }
      const power_W = p.power_W.value;
      // A power the file states that is zero or negative is kept as stated (never solved to a voltage,
      // which would take its square root): the voltage keeps what it holds.
      if (p.power_W.entered && !usable(power_W)) return [];
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

/** The mark text for a stated drive level below the minimum: kept and used, with the minimum named. */
function lowDriveText(field: NumberField, value: number): string {
  const min = NumberField.SIGNAL_DRIVEV_V;
  return `${field.label} ${field.format(value)} ${field.unitLabel()} drives the amplifier below ${min.format(min.limits.min)} ${min.unitLabel()}. It is kept and used; check it.`;
}
