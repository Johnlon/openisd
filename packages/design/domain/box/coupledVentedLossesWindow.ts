import { focus } from '../cell.js';
import type { SimpleField } from '../cell.js';
import type { CoupledVentedLosses } from '../losses.js';
import type { CoupledVentedLossesJson } from '../openisdSchema.js';

/** A vented chamber coupled to another (bandpass4's front, bandpass6's and ABC's rear/front),
 *  over its stored `CoupledVentedLossesJson` — has a port AND a coupling, all four factors. */
export class CoupledVentedLossesWindow implements CoupledVentedLosses {
    readonly Ql: SimpleField<number>;
    readonly Qa: SimpleField<number>;
    readonly Qp: SimpleField<number>;
    readonly Qicl: SimpleField<number>;

    constructor(lens: SimpleField<CoupledVentedLossesJson>) {
        this.Ql = focus(lens, 'Ql');
        this.Qa = focus(lens, 'Qa');
        this.Qp = focus(lens, 'Qp');
        this.Qicl = focus(lens, 'Qicl');
    }
}
