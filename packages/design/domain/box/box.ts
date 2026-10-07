import type { BoxType, VentedAlignment } from '../../engine/index.js';
import type { Calculatable, Calculated, Clearable, Entered, Precise, Readable, SimpleField, Unsolvable, Writable } from '../cell.js';
import type { AbcBox } from './abcBox.js';
import type { Bandpass4Box } from './bandpass4Box.js';
import type { Bandpass6Box } from './bandpass6Box.js';
import type { PassiveRadiatorBox } from './passiveRadiatorBox.js';
import type { SealedBox } from './sealedBox.js';
import type { VentedBox } from './ventedBox.js';
import type { Vent } from '../vent.js';

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
    volumeOf(type: BoxType): Readable<number | null> & Entered & Precise & Writable<number> & Clearable;
    /** The front-chamber volume field of a two-chamber `type`; null for the one-cabinet types. */
    frontVolumeOf(type: BoxType): (Readable<number | null> & Entered & Precise & Writable<number> & Clearable) | null;
    /** The rear-chamber tuning field of a `type` that tunes its rear chamber (bandpass6, abc);
     *  null otherwise. */
    rearTuningOf(type: BoxType): TuningField | null;
    /** The ported chamber's vent group — the volume, tuning goal and vent tied by the Helmholtz
     *  relation: the FRONT chamber of a two-chamber type, the one cabinet of a vented box. Every
     *  other type answers the vented box's group (dormant data, as `volumeOf` is for a type the
     *  project has not adopted). `type` is passed, not read from `boxType`, for the same reason. */
    ventGroupOf(type: BoxType): VentGroup;
    /** The rear chamber's vent group of a `type` whose rear chamber is ported (bandpass6, abc);
     *  null otherwise. */
    rearVentGroupOf(type: BoxType): VentGroup | null;
    /** The loss sets WinISD's Box losses popup edits for `type`, one per chamber panel: one
     *  untitled set (Ql/Qa of the one cabinet, Qp of a ported one) or, for a two-chamber type, a
     *  Rear chamber and a Front chamber set. Both sets of a two-chamber type carry the same Qicl
     *  field (WinISD's one Qiclfr); the rear chamber of a 4th-order bandpass has no Qp. */
    lossGroupsOf(type: BoxType): readonly BoxLossGroup[];
    /** Put the `chamber` set of `lossGroupsOf(type)` back to WinISD's defaults (Ql 10, Qa 100,
     *  Qp 100 where there is a port, Qicl 100 where there is one; the Qicl is shared, so a reset
     *  of either chamber resets it). */
    resetLossesOf(type: BoxType, chamber: LossChamber): void;
    /** Give the active type its starting values where nothing is entered yet; nothing entered is
     *  overwritten. Runs on `boxType.set()` and at `ProjectBuilder.build()`. */
    applyStartingValues(): void;
    /** Re-derive the vented box's volume and tuning from a named alignment (the same QB3-style
     *  design `applyStartingValues` gives a fresh box, unless `alignment` is given), UNLIKE
     *  `applyStartingValues` overwriting unconditionally. Used when clearing Target Tuning Freq
     *  (or Vent length) leaves nothing entered on either side of the Helmholtz pair: falling
     *  back to a real alignment instead of leaving both blank and unrecoverable (QO142). A no-op
     *  if the driver has no design to give (Fs/Qts/Vas unresolved). */
    resetVentedAlignment(alignment?: VentedAlignment): void;
}

export interface VentGroup {
    readonly volume_m3: Readable<number | null> & Entered & Precise & Writable<number> & Clearable;
    readonly tuning_goal_hz: TuningField;
    readonly vent: Vent;
}

export type TuningField = Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;

/** Which part of the box a loss set belongs to: the one cabinet, or a chamber of a two-chamber type. */
export type LossChamber = 'whole' | 'rear' | 'front';

/** One set of rows in the Box losses popup. */
export interface BoxLossGroup {
    readonly chamber: LossChamber;
    /** The chamber the set belongs to, shown above its rows; null when the type has one set. */
    readonly heading: string | null;
    readonly Ql: SimpleField<number>;
    readonly Qa: SimpleField<number>;
    readonly Qp: SimpleField<number> | null;
    /** The interchamber Qicl, one value shared by every set of a two-chamber type; null where the
     *  type has one chamber. */
    readonly Qicl: SimpleField<number> | null;
}
