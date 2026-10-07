import type {IssueEngine} from '../../engine/index.js';
import { focus, nullableField } from '../cell.js';
import type { Calculatable, Calculated, Clearable, Entered, Precise, Readable, SimpleField, Unsolvable, Writable } from '../cell.js';
import type { CoupledVentedLosses } from '../losses.js';
import type { VentedChamber } from './ventedChamber.js';
import type { CoupledVentedChamberJson } from '../openisdSchema.js';
import { CoupledVentedLossesWindow } from './coupledVentedLossesWindow.js';

/** `VentedChamberWindow` for the rear chamber of bandpass6 and ABC, which also holds the box's
 *  one Qicl; the shape `CoupledVentedChamber` names. */
export class CoupledVentedChamberWindow {
    readonly volume_m3: Readable<number | null> & Entered & Precise & Writable<number> & Clearable;
    readonly tuning_goal_hz: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly losses: CoupledVentedLosses;

    constructor(
        lens: SimpleField<CoupledVentedChamberJson>,
        /** The tuning target, paired with the chamber's vent length by the box that owns both. */
        tuning: VentedChamber['tuning_goal_hz'],
        volumeLabel: string, issues: IssueEngine,
    ) {
        this.volume_m3 = nullableField(lens, 'volume_m3', (v) => issues.requiredPositiveIssue(volumeLabel, v));
        this.tuning_goal_hz = tuning;
        this.losses = new CoupledVentedLossesWindow(focus(lens, 'losses'));
    }
}
