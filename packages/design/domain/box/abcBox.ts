import type { Vent } from '../vent.js';
import type { VentedChamber } from './ventedChamber.js';

/**
 * "Aperiodic BI-Chamber" — TWO chambers (rear, front — same shape as bandpass6's, no vent nested
 * in either), THREE ports: rear's own port to outside air, front's own port to outside air, and
 * a third port CONNECTING the two chambers directly (`vents.intra`) — a flat sibling of
 * `vents.rear`/`vents.front`, owned by neither chamber (no `chambers.intra`, no third air
 * volume).
 *
 * The connecting port has NO losses of its own here, deliberately. An earlier cut carried an
 * `intraLosses` field, inferred from the `Qiclfr`/`Qiclfc`/`Qiclcr` names in WinISD's own `.wpr`
 * format — but inference is not evidence: no WinISD screen shows losses for that port, and the
 * live probe (BUG_20260824) never captured an Advanced popup for it, if one even exists. A
 * field with no evidence behind it is a fabrication, so it is gone until a probe finds one.
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
}
