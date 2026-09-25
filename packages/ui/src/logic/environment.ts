/**
 * Small, stateless engine formulas a component needs directly — not project state, just
 * physics with no home yet in `ManagedProject`. Each wraps exactly one `Engine` method
 * so a component reads its number from here instead of naming the engine itself
 * (architecture.test.ts "a component imports no value from the domain").
 */
import type {Air, AirEnvironment} from '@openisd/design/engine';
import {Engine, LossMode} from '@openisd/design/engine';
import type {SelectorOption} from '@openisd/design/fields';

export function airForEnvironment(env: AirEnvironment): Air {
    return new Engine().solveEnvironment(env).values;
}

/** EBP = Fs/Qes — the vented-box suitability figure OgTune.vue's Vents pane shows. */
export function ebpOf(Fs_hz: number, Qes: number): number {
    return new Engine().ebp(Fs_hz, Qes);
}

/** Speed of sound / air density at the reference environment — an empty `AirEnvironment`,
 *  every field of which falls back to the reference condition inside the engine
 *  (`docs/design/WINISD_SCHEMA.md` §12). Functions, not values, so the driver editor's
 *  read-only Environment readout never caches a number that could go stale. */
export function referenceC(): number {
    return new Engine().solveEnvironment({}).values.c;
}

export function referenceRho(): number {
    return new Engine().solveEnvironment({}).values.rho;
}

/** The string→member boundary for the sealed-box loss model, and the picker's option list —
 *  logic owns both so no component names `@openisd/design/engine` itself (the layering gate) and no
 *  re-export exists (QO80). Same pattern as `series.ts`'s `parseChartTabId`. */
export function parseLossMode(token: string): LossMode {
    return LossMode.parse(token);
}

export function lossModeOptions(): readonly SelectorOption<string>[] {
    return LossMode.ALL.map(m => ({value: m.value, label: m.label}));
}
