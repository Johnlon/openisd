import { focus } from '../cell.js';
import type { SimpleField } from '../cell.js';
import type { CoupledSealedLosses } from '../losses.js';
import type { CoupledSealedLossesJson } from '../openisdSchema.js';

/** A sealed chamber coupled to another (bandpass4's rear), over its stored
 *  `CoupledSealedLossesJson` — no port (no `Qp`), coupled to the other chamber (`Qicl`). */
export class CoupledSealedLossesWindow implements CoupledSealedLosses {
    readonly Ql: SimpleField<number>;
    readonly Qa: SimpleField<number>;
    readonly Qicl: SimpleField<number>;

    constructor(lens: SimpleField<CoupledSealedLossesJson>) {
        this.Ql = focus(lens, 'Ql');
        this.Qa = focus(lens, 'Qa');
        this.Qicl = focus(lens, 'Qicl');
    }
}
