import type { Calculatable, Calculated, Clearable, Entered, Precise, Readable, Unsolvable, Writable } from '../cell.js';
import type { CoupledVentedLosses, VentedLosses } from '../losses.js';

/** A chamber with a volume, a tuning and a port: bandpass6's and ABC's front chamber. Its Qicl is
 *  not its own: WinISD has one, the rear chamber's. */
export interface VentedChamber {
    readonly volume_m3: Readable<number | null> & Entered & Precise & Writable<number> & Clearable;
    readonly tuning_goal_hz: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly losses: VentedLosses;
}

/** bandpass6's and ABC's rear chamber: a `VentedChamber` that also holds the box's one Qicl. */
export interface CoupledVentedChamber extends VentedChamber {
    readonly losses: CoupledVentedLosses;
}
