/**
 * How a multi-coil driver's voice coils are wired — the named enum, the record's own numeric
 * encoding for it, and the WinISD defaults for a driver stating neither a wiring nor a coil
 * count. Split out of `openisdSchema.ts` (that file declares data shapes only) — this is logic:
 * how a stored number becomes a named wiring and back, and what WinISD assumes when neither is
 * stated.
 */
import type {SpecEntryJson} from './openisdSchema.js';

/**
 * How a multi-coil driver's voice coils are wired.
 *
 * NAMED, never WinISD's `1`/`2` (John, 2026-08-28: "encoding in openisd is 'series' not '2' —
 * convert to '2' on serialisation to wpr/wdr", and "same principle applies to other numeric
 * enums"). A magic number in the record forces every reader to hold a translation table, and a
 * mis-set 1 reads as valid data rather than as the mistake it is. The numeric encoding is a
 * property of WinISD's file format and belongs in the `.wdr`/`.wpr` adapter alone.
 *
 * The domain already works this way for the enums it inherited — `BoxType` and `VentShape` are
 * names here and numbers only in the file.
 */
export const VoiceCoilWiring = {
    Parallel: 'parallel',
    Series: 'series',
} as const;

/** The wiring values, as a type. Declared from the object above rather than as a second literal
 *  union, so there is exactly ONE place the members are written and a new member cannot be added
 *  to one and forgotten in the other. */
export type VoiceCoilWiring = typeof VoiceCoilWiring[keyof typeof VoiceCoilWiring];

/** `VCCon` as the CORPUS stores it, and back.
 *
 *  The record holds a NUMBER — `1 = parallel, 2 = series`, which is the record's own definition
 *  text and WinISD's encoding. The API holds a NAME, because a caller writing `2` cannot be
 *  checked and a caller writing `VoiceCoilWiring.Series` can. Both directions live here, next to
 *  each other, so the encoding is stated once rather than assumed at each end.
 *
 *  A number the encoding does not define reads as absence: an unknown wiring is not a wiring. */
export function wiringFromRecord(value: number | null): VoiceCoilWiring | null {
    if (value === 1) return VoiceCoilWiring.Parallel;
    if (value === 2) return VoiceCoilWiring.Series;
    return null;
}

/** WinISD's own default when a driver states no wiring — `docs/spec/SPEC_ENGINE.md:424`,
 *  "Defaults are 0, except numVC=1, VCCon=1". Not a computation: a documented constant, the
 *  same fact `calcNumVC()` states for coil count. The ONE place either is written down, so
 *  `DriverSpecsSection`'s getter and the `.wdr` exporter (which reads the getter, not this
 *  function, directly) agree instead of each stating '1' on its own. */
export function calcVCCon(): VoiceCoilWiring {
    return VoiceCoilWiring.Parallel;
}

/** WinISD's own default when a driver states no coil count — same source as `calcVCCon()`. */
export function calcNumVC(): number {
    return 1;
}

/** The record's number for a wiring — the other direction of `wiringFromRecord`, stated once so
 *  the entered and calculated entry builders below cannot drift apart. */
export function wiringToRecord(value: VoiceCoilWiring): number {
    return value === VoiceCoilWiring.Series ? 2 : 1;
}

export function enteredWiring(value: VoiceCoilWiring): SpecEntryJson {
    return {state: 'E', value: wiringToRecord(value)};
}

/** The wiring a resolve derived — `calcVCCon()`'s default, stored as a real 'C' entry rather
 *  than conjured at read time (John, 2026-09-24: "simply no reason for these exceptions to the
 *  rule"). Wiring's counterpart to `calculatedEntry`. */
export function calculatedWiring(value: VoiceCoilWiring): SpecEntryJson {
    return {state: 'C', value: wiringToRecord(value)};
}
