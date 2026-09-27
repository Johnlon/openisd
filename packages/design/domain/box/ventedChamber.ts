import type { Calculatable, Calculated, Clearable, Entered, Precise, Readable, Unsolvable, Writable } from '../cell.js';
import type { CoupledVentedLosses } from '../losses.js';

export interface VentedChamber {
    readonly volume_m3: Readable<number> & Entered & Writable<number>;
    readonly tuning_goal_hz: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly losses: CoupledVentedLosses;
}
