import type { BoxType } from '../../engine/index.js';
import type { Calculatable, Calculated, Clearable, Entered, Precise, Readable, SimpleField, Unsolvable, Writable } from '../cell.js';
import type { AbcBox } from './abcBox.js';
import type { Bandpass4Box } from './bandpass4Box.js';
import type { Bandpass6Box } from './bandpass6Box.js';
import type { PassiveRadiatorBox } from './passiveRadiatorBox.js';
import type { SealedBox } from './sealedBox.js';
import type { VentedBox } from './ventedBox.js';

/** The enclosure: which box type is active, and every box type's own fields. All six are
 *  present at once and dormant unless `boxType` names them — the dormant-data rule expressed in
 *  the type, rather than left to callers to honour. */
export interface Box {
    readonly boxType: SimpleField<BoxType>;
    readonly sealed: SealedBox;
    readonly vented: VentedBox;
    readonly bandpass4: Bandpass4Box;
    readonly bandpass6: Bandpass6Box;
    readonly abc: AbcBox;
    readonly passiveRadiator: PassiveRadiatorBox;
    /** The main-volume field of `type`: the one cabinet of a sealed, vented or passive-radiator
     *  box, the rear chamber of a two-chamber box. `type` is passed, not read from `boxType`,
     *  because a shell's box selector may hold a type the project has not adopted yet. */
    volumeOf(type: BoxType): Readable<number> & Entered & Writable<number>;
    /** The front-chamber volume field of a two-chamber `type`; null for the one-cabinet types. */
    frontVolumeOf(type: BoxType): (Readable<number> & Entered & Writable<number>) | null;
    /** The rear-chamber tuning field of a `type` that tunes its rear chamber (bandpass6, abc);
     *  null otherwise. */
    rearTuningOf(type: BoxType): TuningField | null;
    /** The box-level losses WinISD's Box losses dialog edits for `type`: Ql/Qa of the one
     *  cabinet (or the rear chamber of a 4th-order bandpass), Qp of the ported chamber, null
     *  where the type has no port. Null for bandpass6/abc, whose losses are per chamber. */
    lossesOf(type: BoxType): BoxLosses | null;
    /** Give the active type its starting values where nothing is entered yet; nothing entered is
     *  overwritten. Runs on `boxType.set()` and at `ProjectBuilder.build()`. */
    applyStartingValues(): void;
}

export type TuningField = Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;

export interface BoxLosses {
    readonly Ql: SimpleField<number>;
    readonly Qa: SimpleField<number>;
    readonly Qp: SimpleField<number> | null;
}
