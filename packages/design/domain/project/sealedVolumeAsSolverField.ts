import type { SolverField } from '../../engine/index.js';
import type { SimpleField } from '../cell.js';

/** Adapts `box.sealed.volume_m3` (a plain `SimpleField<number>` — the schema never gave the box's
 *  own stated volume a C/E flag) into the `SolverField<number>` shape `Vb_m3` needs to hand
 *  `Engine.solveSealedAlignment` (S10). A zero or negative volume reads as null — "a zero volume
 *  is not a very small box; it is no box" (the same check `#sealedResonance_hz`/`#sealedQtc`
 *  made before this adapter replaced them).
 *
 *  The write methods are STRUCTURALLY unreachable, not just unused today: `entered` is always
 *  `true`, and `solveSealedAlignment`'s only route that writes `Vb_m3` is gated on
 *  `!params.Vb_m3.entered` — so that route can never be taken, whatever a caller states for
 *  `Qtc`. Throwing keeps that invariant visible instead of silently discarding a solved volume
 *  a future change might otherwise expect this adapter to store somewhere. */
export function sealedVolumeAsSolverField(volume: SimpleField<number>): SolverField<number> {
    const unreachable = (): never => {
        throw new Error(
            'sealedVolumeAsSolverField: Vb_m3 write attempted — structurally unreachable, since ' +
            'this adapter always reports entered:true (see the function\'s own doc comment).');
    };
    return {
        get value() { const v = volume.value; return v > 0 ? v : null; },
        entered: true,
        calculated: false,
        precision: null,
        dq: [],
        setCalculated: unreachable,
        setDq: unreachable,
        setNotAvailable: unreachable,
    };
}
