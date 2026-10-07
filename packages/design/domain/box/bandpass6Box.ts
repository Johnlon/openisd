import type { Vent } from '../vent.js';
import type { CoupledVentedChamber, VentedChamber } from './ventedChamber.js';

/** UNLIKE bandpass4: BOTH chambers are vented and independently tunable. */
export interface Bandpass6Box {
    readonly chambers: {
        readonly rear: CoupledVentedChamber;
        readonly front: VentedChamber;
    };
    readonly vents: {
        readonly rear: Vent;
        readonly front: Vent;
    };
}
