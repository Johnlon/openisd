import { defaultedField, focus } from '../cell.js';
import type { Clearable, SimpleField } from '../cell.js';
import type { SealedLosses } from '../losses.js';
import type { SealedLossesJson } from '../openisdSchema.js';
import { WINISD_BOX_LOSSES } from '../boxDefaults.js';

// ---------------------------------------------------------------------------------------------
// THE BOX WINDOW — the implementation of the shapes above, over the stored record.
// ---------------------------------------------------------------------------------------------

/** A sealed chamber's two loss factors, over its stored `SealedLossesJson` — no port, so no
 *  `Qp`; no coupling to another chamber, so no `Qicl` (BUG_20260824's live-confirmed shape).
 *  A cleared loss factor settles to the WinISD default the box starts with (John, 2026-10-16):
 *  `defaultedField`, so `clear()` writes `WINISD_BOX_LOSSES.Ql`/`Qa` rather than a blank. */
export class SealedLossesWindow implements SealedLosses {
    readonly Ql: SimpleField<number> & Clearable;
    readonly Qa: SimpleField<number> & Clearable;

    constructor(lens: SimpleField<SealedLossesJson>) {
        // Each loss factor is its own `focus()` over the losses record, with no wrapper in between.
        this.Ql = defaultedField(focus(lens, 'Ql'), WINISD_BOX_LOSSES.Ql);
        this.Qa = defaultedField(focus(lens, 'Qa'), WINISD_BOX_LOSSES.Qa);
    }
}
