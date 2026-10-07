import type {IssueEngine} from '../../engine/index.js';
import { focus, nullableField } from '../cell.js';
import type { Calculatable, Calculated, Clearable, Entered, Precise, Readable, SimpleField, Unsolvable, Writable } from '../cell.js';
import type { VentedLosses } from '../losses.js';
import type { VentedChamber } from './ventedChamber.js';
import type { ChamberJson } from '../openisdSchema.js';
import { VentedLossesWindow } from './ventedLossesWindow.js';

/** A chamber with both a volume and a tuning of its own and no Qicl — bandpass6's and ABC's
 *  front, and the shape `VentedChamber` names. */
export class VentedChamberWindow {
    readonly volume_m3: Readable<number | null> & Entered & Precise & Writable<number> & Clearable;
    readonly tuning_goal_hz: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly losses: VentedLosses;

    /** `volumeLabel`: what the ⚠ of a blank volume calls it, e.g. 'Front chamber volume'. */
    constructor(
        lens: SimpleField<ChamberJson>,
        /** The tuning target, paired with the chamber's vent length by the box that owns both. */
        tuning: VentedChamber['tuning_goal_hz'],
        volumeLabel: string, issues: IssueEngine,
    ) {
        this.volume_m3 = nullableField(lens, 'volume_m3', (v) => issues.requiredPositiveIssue(volumeLabel, v));
        this.tuning_goal_hz = tuning;
        this.losses = new VentedLossesWindow(focus(lens, 'losses'));
    }
}
