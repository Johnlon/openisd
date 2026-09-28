import type { Calculatable, Calculated, Clearable, Entered, Precise, Readable, Unsolvable, Writable } from '../cell.js';
import type { SealedLosses } from '../losses.js';

export interface SealedBox {
    /** Mandatory: judged by `Engine.positiveValueIssue` on read, box-agnostic
     *  (BUG_20260927_box-volume-validity-decided-in-ui.md) — zero, negative or non-finite marks
     *  the field's own `.dq` rather than being coerced. */
    readonly volume_m3: Readable<number> & Entered & Writable<number>;

    /** The resulting system Fc, calculated from the volume and the driver — null when either is
     *  not yet known. A CALCULATION, not a stored field, so a readout, not a handle. */
    readonly resonance_hz: Readable<number | null> & Calculated;

    /** The resulting system Q (Qtc), under the same loss mode as `resonance_hz` — null on the
     *  same terms. An ENTRY read (S10): the project's `#resolve()` cascade writes it as a
     *  calculated C/E entry via `SealedEngine.solve`, the same pattern the vent's
     *  `tuning_goal_hz`/the PR's `tuning_goal_hz` already use — not a readout recomputed on every
     *  read. */
    readonly q_tc: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;

    readonly losses: SealedLosses;
}
