import type {IssueEngine} from '../../engine/index.js';
import { entryField, focus, nullableField } from '../cell.js';
import type { Calculatable, Calculated, Clearable, Entered, Precise, Readable, SimpleField, Unsolvable, Writable } from '../cell.js';
import type { CoupledVentedLosses } from '../losses.js';
import type { CoupledVentedChamberJson } from '../openisdSchema.js';
import { CoupledVentedLossesWindow } from './coupledVentedLossesWindow.js';

/** A chamber with both a volume and a tuning of its own — bandpass6's and ABC's, and the shape
 *  `VentedChamber` names in `box.ts`. */
export class VentedChamberWindow {
    readonly volume_m3: Readable<number | null> & Entered & Precise & Writable<number> & Clearable;
    readonly tuning_goal_hz: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly losses: CoupledVentedLosses;

    /** `volumeLabel`: what the ⚠ of a blank volume calls it, e.g. 'Rear chamber volume'. */
    constructor(lens: SimpleField<CoupledVentedChamberJson>, volumeLabel: string, issues: IssueEngine) {
        this.volume_m3 = nullableField(lens, 'volume_m3', (v) => issues.requiredPositiveIssue(volumeLabel, v));
        this.tuning_goal_hz = entryField(focus(lens, 'tuning_goal_hz'), 'tuning_goal_hz');
        this.losses = new CoupledVentedLossesWindow(focus(lens, 'losses'));
    }
}
