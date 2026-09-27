import { focus } from '../cell.js';
import type { SimpleField } from '../cell.js';
import type { SealedLosses } from '../losses.js';
import type { SealedLossesJson } from '../openisdSchema.js';

// ---------------------------------------------------------------------------------------------
// THE BOX WINDOW — the implementation of the shapes above, over the stored record.
// ---------------------------------------------------------------------------------------------

/** A sealed chamber's two loss factors, over its stored `SealedLossesJson` — no port, so no
 *  `Qp`; no coupling to another chamber, so no `Qicl` (BUG_20260824's live-confirmed shape). */
export class SealedLossesWindow implements SealedLosses {
    readonly Ql: SimpleField<number>;
    readonly Qa: SimpleField<number>;

    constructor(lens: SimpleField<SealedLossesJson>) {
        // Each loss factor is its own `focus()` over the losses record, with no wrapper in between.
        this.Ql = focus(lens, 'Ql');
        this.Qa = focus(lens, 'Qa');
    }
}
