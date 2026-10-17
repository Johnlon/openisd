import {FixedAir, createEngine} from '../../engine/index.js';
import type {Air, AirEnvironment, AirValues} from '../../engine/index.js';

/** WinISD's reference conditions, written out: 20 °C, 30 % humidity, 101325 Pa. A test that needs air
 *  names these, or its own three conditions; no calculation defaults to them. */
export const REFERENCE_CONDITIONS: AirEnvironment = Object.freeze({tempK: 293.15, humidityPct: 30, pressurePa: 101325});

/** c and ρ of the reference conditions, as plain numbers. */
export const REFERENCE_AIR_VALUES: AirValues = createEngine().environment.solve(REFERENCE_CONDITIONS).values;

/** The reference conditions as the `Air` an engine API takes from its caller. */
export const REFERENCE_AIR: Air = new FixedAir(REFERENCE_AIR_VALUES);

/** The `Air` of any three stated conditions. */
export function airOfConditions(conditions: AirEnvironment): Air {
  return new FixedAir(createEngine().environment.solve(conditions).values);
}
