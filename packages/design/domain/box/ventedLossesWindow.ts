import { defaultedField, focus } from '../cell.js';
import type { Clearable, SimpleField } from '../cell.js';
import type { VentedLosses } from '../losses.js';
import type { VentedLossesJson } from '../openisdSchema.js';
import { WINISD_BOX_LOSSES } from '../boxDefaults.js';

/** A standalone vented chamber's three loss factors, over its stored `VentedLossesJson` — has a
 *  port (`Qp`), no coupling to another chamber (no `Qicl`). A cleared loss factor settles to
 *  the WinISD default (John, 2026-10-16), exactly as a sealed chamber's does. */
export class VentedLossesWindow implements VentedLosses {
    readonly Ql: SimpleField<number> & Clearable;
    readonly Qa: SimpleField<number> & Clearable;
    readonly Qp: SimpleField<number> & Clearable;

    constructor(lens: SimpleField<VentedLossesJson>) {
        this.Ql = defaultedField(focus(lens, 'Ql'), WINISD_BOX_LOSSES.Ql);
        this.Qa = defaultedField(focus(lens, 'Qa'), WINISD_BOX_LOSSES.Qa);
        this.Qp = defaultedField(focus(lens, 'Qp'), WINISD_BOX_LOSSES.Qp);
    }
}
