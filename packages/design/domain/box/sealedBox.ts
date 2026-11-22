import type { Calculatable, Calculated, Clearable, Entered, Precise, Readable, Unsolvable, Writable } from '../cell.js';
import type { SealedLosses } from '../losses.js';

export interface SealedBox {
    /** Mandatory: judged by `Engine.positiveValueIssue` on read, box-agnostic
     *  (BUG_20260927_box-volume-validity-decided-in-ui.md) — zero, negative or non-finite marks
     *  the field's own `.dq` rather than being coerced. */
    readonly volume_m3: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable;

    /** The system Fc: calculated from the volume and the driver (null when either is not yet
     *  known), or entered, which makes the volume calculated from it. Vb, Fsc and Qtc each fix
     *  the other two; exactly one is entered (docs/design/FIELD_CLEAR_RULE.md). */
    readonly resonance_hz: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable;

    /** The resulting system Q (Qtc), under the same loss mode as `resonance_hz` — null on the
     *  same terms. An ENTRY read (S10): the project's `#resolve()` cascade writes it as a
     *  calculated C/E entry via `SealedEngine.solve`, the same pattern the vent's
     *  `tuning_goal_hz`/the PR's `tuning_goal_hz` already use — not a readout recomputed on every
     *  read. */
    readonly q_tc: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;

    readonly losses: SealedLosses;
}
