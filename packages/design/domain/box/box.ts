import type { BoxType } from '../../engine/index.js';
import type { Entered, Readable, SimpleField, Writable } from '../cell.js';
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
}
