import type { Clearable, SimpleField } from '../cell.js';
import type { Vent } from '../vent.js';
import type { VentedChamber } from './ventedChamber.js';

/** UNLIKE bandpass4: BOTH chambers are vented and independently tunable. */
export interface Bandpass6Box {
    readonly chambers: {
        readonly rear: VentedChamber;
        readonly front: VentedChamber;
    };
    readonly vents: {
        readonly rear: Vent;
        readonly front: Vent;
    };
    /** The interchamber Qicl; a clear settles it to the WinISD default (John, 2026-10-16). */
    readonly Qiclfr: SimpleField<number> & Clearable;
}
