/**
 * Small, stateless engine formulas a component needs directly — not project state, just
 * physics with no home yet in `ManagedProject`. Each wraps exactly one `Engine` method
 * so a component reads its number from here instead of naming the engine itself
 * (architecture.test.ts "a component imports no value from the domain").
 */
import { Engine, LossMode } from '@openisd/design/engine';
import type { Air, AirEnvironment, EngineDriver } from '@openisd/design/engine';

export function airForEnvironment(env: AirEnvironment): Air {
    return new Engine().airFor(env);
}

/**
 * The environment `airFor` actually runs in once the WinISD toggle is honoured.
 * `ignoreHumidityAndPressure` means "ignore the PROJECT's stored humidity and pressure" —
 * real WinISD never reads its project's `[Box]` environment and computes `c`/`roo` from its
 * APP-LEVEL Options dialog instead (`docs/design/WINISD_SCHEMA.md` §12/§13). openisd's
 * app-level analog is Options → General → Environment (`presentationState.ui.envDefaults`),
 * which the caller passes here. Temperature stays the project's own: the toggle's label names
 * exactly what it discards, and at the default temperature the substituted environment lands
 * `airFor` on WinISD's measured pair exactly (engine `WINISD_MEASURED_*`, ledger QO88).
 * With the flag off, the project's environment passes through untouched.
 */
export function resolveAirEnvironment<T extends AirEnvironment>(
    env: T, appLevel: { humidityPct: number; pressurePa: number }): T {
    if (!env.ignoreHumidityAndPressure) return env;
    return { ...env, humidityPct: appLevel.humidityPct, pressurePa: appLevel.pressurePa };
}

/** EBP = Fs/Qes — the vented-box suitability figure OgTune.vue's Vents pane shows. */
export function ebpOf(driver: EngineDriver): number {
    return new Engine().ebp(driver);
}

/** Drive voltage from input power and the driver's DC resistance — OriginalShell.vue's
 *  Signal-source readout. */
export function driveVoltageFor(inputPowerW: number, reOhm: number): number {
    return new Engine().driveVoltage(inputPowerW, reOhm);
}

/** Fallback DC resistance for the drive-voltage readout when the driver is too incomplete to
 *  resolve an `EngineDriver` (so `.Re` is unavailable) — the nominal impedance of a typical
 *  driver, standing in only until enough of a real one is entered. */
export const DEFAULT_RE_OHM = 8;

/** Speed of sound / air density at the reference environment — an empty `AirEnvironment`,
 *  every field of which falls back to the reference condition inside the engine
 *  (`docs/design/WINISD_SCHEMA.md` §12). Functions, not values, so the driver editor's
 *  read-only Environment readout never caches a number that could go stale. */
export function referenceC(): number {
    return new Engine().airFor({}).c;
}

export function referenceRho(): number {
    return new Engine().airFor({}).rho;
}

/** The string→member boundary for the sealed-box loss model, and the picker's option list —
 *  logic owns both so no component names `@openisd/design/engine` itself (the layering gate) and no
 *  re-export exists (QO80). Same pattern as `series.ts`'s `parseChartTabId`. */
export function parseLossMode(token: string): LossMode {
    return LossMode.parse(token);
}

export function lossModeOptions(): { value: string; label: string }[] {
    return LossMode.ALL.map(m => ({value: m.value, label: m.label}));
}
