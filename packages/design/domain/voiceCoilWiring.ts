/**
 * How a multi-coil driver's voice coils were wired when Re and BL were measured — the named enum
 * and its record entries. The record stores the name (QO914, #514); WinISD's 1/2 code is the
 * `.wdr` adapter's (`winIsdDriverImport.ts`, `driverRecordConverter.ts`). There is no default: a
 * wiring the record does not state is unknown (QO900 R1).
 */
import type {WiringEntryJson} from './openisdSchema.js';

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

export function enteredWiring(value: VoiceCoilWiring): WiringEntryJson {
    return {state: 'E', value};
}

/** The wiring a resolve inferred (QO903 R4), stored as a real 'C' entry. Wiring's counterpart to
 *  `calculatedEntry`. */
export function calculatedWiring(value: VoiceCoilWiring): WiringEntryJson {
    return {state: 'C', value};
}
