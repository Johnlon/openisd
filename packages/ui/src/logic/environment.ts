/**
 * Small, stateless engine formulas a component needs directly — not project state, just
 * physics with no home yet in `ManagedOpenISDProject`. Each wraps exactly one `@openisd/engine`
 * export so a component reads its number from here instead of naming the engine itself
 * (architecture.test.ts "a component imports no value from the domain").
 */
import { airFor, ebp as engineEbp, driveVoltage as engineDriveVoltage, LossMode, RHO, C } from '@openisd/engine';
import type { Air, AirEnvironment, EngineDriver } from '@openisd/engine';

export function airForEnvironment(env: AirEnvironment): Air {
  return airFor(env);
}

/** EBP = Fs/Qes — the vented-alignment suitability figure OgTune.vue's Vents pane shows. */
export function ebpOf(driver: EngineDriver): number {
  return engineEbp(driver);
}

/** Drive voltage from input power and the driver's DC resistance — OriginalShell.vue's
 *  Signal-source readout. */
export function driveVoltageFor(inputPowerW: number, reOhm: number): number {
  return engineDriveVoltage(inputPowerW, reOhm);
}

/** OpenISD's fixed engine constants (20°C air density, speed of sound) — re-exported so the
 *  driver editor's read-only Environment readout does not import `@openisd/engine` itself. */
export { RHO, C };

/** The sealed-box loss model enum — re-exported so a component's loss-mode picker (Options
 *  dialog) does not name `@openisd/engine` itself. Not a formula: a wire-format enum, same
 *  reason `DriverType`/`Chip` are UI-owned rather than engine-owned. */
export { LossMode };
