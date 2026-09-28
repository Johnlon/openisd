/**
 * Small, stateless engine formulas a component needs directly — not project state, just
 * physics with no home yet in `ManagedProject`. Each wraps exactly one `Engine` method
 * so a component reads its number from here instead of naming the engine itself
 * (architecture.test.ts "a component imports no value from the domain"). The engine is the
 * one the composition root built, passed in — never constructed here.
 */
import type {Air, AirEnvironment, Engine} from '@openisd/design/engine';
import {LossMode} from '@openisd/design/engine';
import type {SelectorOption} from '@openisd/design/fields';

export function airForEnvironment(engine: Engine, env: AirEnvironment): Air {
    return engine.solveEnvironment(env).values;
}

/** EBP = Fs/Qes — the vented-box suitability figure the Vents pane shows. */
export function ebpOf(engine: Engine, Fs_hz: number, Qes: number): number {
    return engine.ebp(Fs_hz, Qes);
}

/** The string→member boundary for the sealed-box loss model, and the picker's option list —
 *  logic owns both so no component names `@openisd/design/engine` itself (the layering gate) and no
 *  re-export exists (QO80). Same pattern as `series.ts`'s `parseChartId`. */
export function parseLossMode(token: string): LossMode {
    return LossMode.parse(token);
}

export function lossModeOptions(): readonly SelectorOption<string>[] {
    return LossMode.ALL.map(m => ({value: m.value, label: m.label}));
}
