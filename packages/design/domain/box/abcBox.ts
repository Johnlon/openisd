import type { SimpleField } from '../cell.js';
import type { Vent } from '../vent.js';
import type { VentedChamber } from './ventedChamber.js';

/**
 * "Aperiodic BI-Chamber" — TWO chambers (rear, front — same shape as bandpass6's, no vent nested
 * in either), THREE ports: rear's own port to outside air, front's own port to outside air, and
 * a third port CONNECTING the two chambers directly (`vents.intra`) — a flat sibling of
 * `vents.rear`/`vents.front`, owned by neither chamber (no `chambers.intra`, no third air
 * volume).
 *
 * The connecting port has no losses of its own here. WinISD's Advanced-> in each chamber panel shows
 * one interchamber Qicl, the `.wpr` `Qiclfr` (probe e7c754c, `winisd_research/PROBE_FINDINGS.md`);
 * it is stored on `Qiclfr`, the value the sweep reads. No WinISD screen shows
 * the `Qiclfc`/`Qiclcr` names, so no field is kept for them.
 */
export interface AbcBox {
    readonly chambers: {
        readonly rear: VentedChamber;
        readonly front: VentedChamber;
    };
    readonly vents: {
        readonly rear: Vent;
        readonly front: Vent;
        readonly intra: Vent;
    };
    readonly Qiclfr: SimpleField<number>;
}
