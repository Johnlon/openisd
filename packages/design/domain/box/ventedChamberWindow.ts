import { Engine } from '../../engine/index.js';
import { entryField, focus, requiredField } from '../cell.js';
import type { Calculatable, Calculated, Clearable, Entered, Precise, Readable, SimpleField, Unsolvable, Writable } from '../cell.js';
import type { CoupledVentedLosses } from '../losses.js';
import type { CoupledVentedChamberJson } from '../openisdSchema.js';
import { CoupledVentedLossesWindow } from './coupledVentedLossesWindow.js';

/** A chamber with both a volume and a tuning of its own — bandpass6's and ABC's, and the shape
 *  `VentedChamber` names in `box.ts`. */
export class VentedChamberWindow {
    readonly volume_m3: Readable<number> & Entered & Writable<number>;
    readonly tuning_goal_hz: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly losses: CoupledVentedLosses;

    constructor(lens: SimpleField<CoupledVentedChamberJson>, engine: Engine) {
        this.volume_m3 = requiredField(lens, 'volume_m3');
        this.tuning_goal_hz = entryField(focus(lens, 'tuning_goal_hz'), 'tuning_goal_hz', engine);
        this.losses = new CoupledVentedLossesWindow(focus(lens, 'losses'));
    }
}
