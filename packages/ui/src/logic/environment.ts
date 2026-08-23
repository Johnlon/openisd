/**
 * Small, stateless engine formulas a component needs directly — not project state, just
 * physics with no home yet in `ManagedOpenISDProject`. Each wraps exactly one `@openisd/engine`
 * export so a component reads its number from here instead of naming the engine itself
 * (architecture.test.ts "a component imports no value from the domain").
 */
import { airFor, ebp as engineEbp, driveVoltage as engineDriveVoltage, LossMode,
         T_REF_K, RH_REF_PCT, P_REF_PA, moistAirSoundVelocity, moistAirDensity } from '@openisd/engine';
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

/** Speed of sound / air density at the reference environment (`T_REF_K`/`RH_REF_PCT`/
 *  `P_REF_PA`), computed live — no constant exists, in WinISD or here
 *  (`docs/design/WINISD_SCHEMA.md` §12). Functions, not values, so the driver editor's
 *  read-only Environment readout never caches a number that could go stale. */
export function referenceC(): number {
    return moistAirSoundVelocity(T_REF_K, RH_REF_PCT, P_REF_PA);
}

export function referenceRho(): number {
    return moistAirDensity(T_REF_K, RH_REF_PCT, P_REF_PA);
}

/** The string→member boundary for the sealed-box loss model, and the picker's option list —
 *  logic owns both so no component names `@openisd/engine` itself (the layering gate) and no
 *  re-export exists (QO80). Same pattern as `series.ts`'s `parseChartTabId`. */
export function parseLossMode(token: string): LossMode {
    return LossMode.parse(token);
}

export function lossModeOptions(): { value: string; label: string }[] {
    return LossMode.ALL.map(m => ({value: m.value, label: m.label}));
}
