/**
 * Driver wiring: how a project's N identical drivers are connected to the amplifier (ticket Johnlon/openisd#519,
 * docs/plans/PLAN_20261116_DRIVER_WIRING.md section 5). The one place that turns an amplifier voltage and Rg into what each
 * driver sees. By symmetry every driver does the same, so each is replaced by a one-driver circuit with its own EMF
 * and series resistance (Thevenin). Coil wiring (the voice coils inside one driver) is a different thing and is never read here.
 *
 * It is also the engine's one home for scaling by the driver count (T934, John 19 Nov 2026: "remove the dupe and fix the
 * guardrail"): `combinedOfN`, `eachOfN` and `oneBoxOfN`. The duplicate-logic check (scripts/dupscan.mjs, homes in
 * scripts/dupscan-homes.json) refuses a driver-count sum written anywhere else.
 */

import type {BoxType, SweepParams} from '../types.js';

export type DriverWiring = 'parallel' | 'series';

/** The wiring of a project that never chose one: Parallel (the saved default, plan 4.1). */
export const DEFAULT_DRIVER_WIRING: DriverWiring = 'parallel';

/** What ONE of n identical drivers sees, and how its impedance maps to the load the amplifier sees. */
export interface DriverDrive {
  /** The voltage across the one-driver circuit's source (V). */
  readonly eg_V: number;
  /** The source resistance in series with that one driver (ohm). */
  readonly Rg_ohm: number;
  /** The amplifier's load is one driver's impedance times this: 1/n in parallel, n in series. */
  readonly loadScale: number;
}

/** What one of `n` drivers sees at amplifier voltage `amp_V` and source resistance `Rg_ohm`.
 *  Parallel: the full voltage, Rg x n at the amplifier. Series: V/n, Rg/n at the amplifier. Rg at each driver stays Rg. n <= 1: unchanged. */
export function driverDrive(n: number, wiring: DriverWiring, amp_V: number, Rg_ohm: number, rgAtDriverSide: boolean): DriverDrive {
  if (n <= 1) return {eg_V: amp_V, Rg_ohm, loadScale: 1};
  if (wiring === 'parallel') return {eg_V: amp_V, Rg_ohm: rgAtDriverSide ? Rg_ohm : n * Rg_ohm, loadScale: 1 / n};
  return {eg_V: amp_V / n, Rg_ohm: rgAtDriverSide ? Rg_ohm : Rg_ohm / n, loadScale: n};
}

/** The amplifier's output voltage that puts `eg_V` across each of `n` drivers: n x in series, 1 x in parallel and for one driver. */
export function amplifierVoltage(n: number, wiring: DriverWiring, eg_V: number): number {
  return n > 1 && wiring === 'series' ? n * eg_V : eg_V;
}

/** A figure of `n` identical drivers taken together, where it adds up: n x one driver's (cone area, compliance, rated power). */
export function combinedOfN(oneDriver: number, n: number): number {
  return oneDriver * n;
}

/** One of `n` identical drivers' share of `whole` (box volume, input power), and equally `n` alike acoustic elements side by
 *  side (mass, resistance, coil impedance): whole / n. */
export function eachOfN(whole: number, n: number): number {
  return whole / n;
}

/** A passive-radiator box with no radiator count stated has one radiator, as `PassiveRadiatorBox` reads it; the count is
 *  written in before the box is shared between drivers, so each of n drivers gets 1/n of it (T928). Other boxes: unchanged. */
export function withStatedRadiatorCount(P: SweepParams, box: BoxType): SweepParams {
  return box === 'box-passive-radiator' && P.prNum === undefined ? { ...P, prNum: 1 } : P;
}

/** One of `n` drivers' share of the box: Vb/n and, where they exist, Vf/n, every port area /n and prNum/n; one driver. */
export function oneBoxOfN(P: SweepParams, n: number): SweepParams {
  return { ...P, nDrivers: 1, Vb: P.Vb / n, ...(P.Vf !== undefined ? { Vf: P.Vf / n } : {}), ...(P.Sp !== undefined ? { Sp: P.Sp / n } : {}), ...(P.prNum !== undefined ? { prNum: P.prNum / n } : {}),
    ...(P.Spr !== undefined ? { Spr: P.Spr / n } : {}), ...(P.SpIntra !== undefined ? { SpIntra: P.SpIntra / n } : {}) };
}

/**
 * The power the array can take: Pe x Nd, x 2 for an Iso-Barik pair, which is two drivers per position, each rated Pe.
 * WinISD's Maximum power does the same: 40 / 80 / 80 / 160 W for the W5-1138SMF (Pe 40 W) at Nd 1, Nd 1 Iso-Barik,
 * Nd 2, Nd 2 Iso-Barik (winisd_research runs/isobarik-more-20261119). Built on `combinedOfN`, the one home for adding up
 * a figure over the drivers.
 */
export function arrayPowerHandling(pe_W: number, nDrivers: number, loading: 'standard' | 'isobaric'): number {
  const driversPerPosition = loading === 'isobaric' ? 2 : 1;
  return combinedOfN(pe_W, combinedOfN(driversPerPosition, nDrivers));
}
