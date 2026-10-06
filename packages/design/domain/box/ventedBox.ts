import type { Calculatable, Calculated, Clearable, Entered, Precise, Readable, Unsolvable, Writable } from '../cell.js';
import type { VentedLosses } from '../losses.js';
import type { Vent } from '../vent.js';

export interface VentedBox {
    readonly volume_m3: Readable<number | null> & Entered & Precise & Writable<number> & Clearable;
    /** WinISD: Fb — the target frequency, which drives `vent`'s dimensions (or vice versa). */
    readonly tuning_goal_hz: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly vent: Vent;
    readonly losses: VentedLosses;
}
