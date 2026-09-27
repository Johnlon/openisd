import { focus } from '../cell.js';
import type { SimpleField } from '../cell.js';
import type { VentedLosses } from '../losses.js';
import type { VentedLossesJson } from '../openisdSchema.js';

/** A standalone vented chamber's three loss factors, over its stored `VentedLossesJson` — has a
 *  port (`Qp`), no coupling to another chamber (no `Qicl`). */
export class VentedLossesWindow implements VentedLosses {
    readonly Ql: SimpleField<number>;
    readonly Qa: SimpleField<number>;
    readonly Qp: SimpleField<number>;

    constructor(lens: SimpleField<VentedLossesJson>) {
        this.Ql = focus(lens, 'Ql');
        this.Qa = focus(lens, 'Qa');
        this.Qp = focus(lens, 'Qp');
    }
}
