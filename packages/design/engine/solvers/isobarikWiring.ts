import {DEFAULT_DRIVER_WIRING, type DriverWiring} from '../array/driverWiring.js';
import {isobarikPair, type DriverWorkingSet} from './driverQuantities.js';

export interface IsobarikSettings {
  readonly loading?: 'standard' | 'isobaric';
  readonly winisdIsobarik?: boolean;
  readonly driverWiring?: DriverWiring;
}

/** The electrical connection within a physical pair. Legacy pairs keep the WinISD motor. */
export function physicalPairWiring(settings: IsobarikSettings): DriverWiring | null {
  return settings.loading === 'isobaric' && settings.winisdIsobarik === false
    ? settings.driverWiring ?? DEFAULT_DRIVER_WIRING
    : null;
}

/** Pair terminal resistance and inductance scale alike. */
export function isobarikImpedanceScale(wiring: DriverWiring | null): number {
  if (wiring === null) return 1;
  return wiring === 'parallel' ? 0.5 : 2;
}

/** Terminal resistance used by the signal solver at the project's coil temperature. */
export function isobarikDriveResistance(re: number | null, settings: IsobarikSettings): number | null {
  return re === null ? null : re * isobarikImpedanceScale(physicalPairWiring(settings));
}

/** Two motors driving one radiating cone. Scaling BL and Re together preserves Qes. */
export function wiredIsobarikPair(drv: Readonly<DriverWorkingSet>, wiring: DriverWiring): DriverWorkingSet {
  const out = isobarikPair(drv);
  if (drv.Re_terminal_ohm !== undefined) out.Re_terminal_ohm = drv.Re_terminal_ohm * isobarikImpedanceScale(wiring);
  if (drv.BL_terminal_Tm !== undefined) out.BL_terminal_Tm = drv.BL_terminal_Tm * isobarikMotorScale(wiring);
  return out;
}

export function isobarikMotorScale(wiring: DriverWiring | null): number {
  return wiring === 'series' ? 2 : 1;
}

