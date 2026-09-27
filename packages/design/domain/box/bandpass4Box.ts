import type { Calculatable, Calculated, Clearable, Entered, Precise, Readable, Unsolvable, Writable } from '../cell.js';
import type { CoupledSealedLosses, CoupledVentedLosses } from '../losses.js';
import type { Vent } from '../vent.js';

// Chambers and vents (ports) are two SEPARATE, sibling groupings — never one bundled into the
// other. `chambers.rear`/`chambers.front` carry ONLY volume/tuning/losses, never a vent; every
// port is a flat sibling under `vents` instead, matching the Vents tab's own three-column
// layout ("Rear chamber"/"Front chamber"/"Intrachamber").
export interface Bandpass4Box {
    readonly chambers: {
        /** rear = the chamber the driver protrudes into, SEALED — no port, so no `vents.rear`, and
         *  a read-only calculated `resonance_hz` (WinISD's "Frc") instead of a tuning to enter. */
        readonly rear: {
            readonly volume_m3: Readable<number> & Entered & Writable<number>;
            readonly resonance_hz: Readable<number | null> & Calculated;
            readonly losses: CoupledSealedLosses;
        };
        /** front = vented; its volume (`Vf`) has a Field readout like every other chamber. */
        readonly front: {
            readonly volume_m3: Readable<number> & Entered & Writable<number>;
            readonly tuning_goal_hz: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
            readonly losses: CoupledVentedLosses;
        };
    };
    readonly vents: {
        readonly front: Vent;
    };
}
