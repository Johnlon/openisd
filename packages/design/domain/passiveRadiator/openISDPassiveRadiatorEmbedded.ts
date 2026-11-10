import type { SimpleField } from '../cell.js';
import type { PrSpecIssue } from '../../engine/index.js';
import type { RadiatorDeviceJson } from '../openisdSchema.js';
import { OpenISDPassiveRadiator } from './openISDPassiveRadiator.js';
import type { RadiatorProjectContext } from './radiatorContext.js';
import { OpenISDPassiveRadiatorStandalone } from './openISDPassiveRadiatorStandalone.js';

/**
 * The radiator INSIDE a box — a window onto the box's own `component` slot, which may hold
 * nothing yet. Implements `PassiveRadiatorComponent`, so it IS what `box.passiveRadiator
 * .component` hands back, rather than a hand-assembled literal of field handles.
 *
 * Has no copy/write-back pair of its own, unlike a driver. The driver editor is a GENERIC
 * component that does not know where its driver came from, so it works on a `detach()`ed copy
 * and writes back with `update()`. The radiator's dedicated tab already knows it is editing a
 * project, so writes from the radiator tab land in the project's own edited layer like any
 * other field write.
 */

export class OpenISDPassiveRadiatorEmbedded extends OpenISDPassiveRadiator {

    /** The lens onto the box's `component` slot, with the box's conflicts and the project's chart context (engine, air, "Cms from Vas"). */
    constructor(slot: SimpleField<RadiatorDeviceJson>, conflicts: () => readonly PrSpecIssue[], private readonly projectContext: RadiatorProjectContext) {
        super(slot, conflicts, projectContext);
    }

    /** This radiator as one belonging to no box — the copy My Passive Radiators holds, and the
     *  inverse of `update()`. Deep-copies, so editing the box afterwards leaves the saved
     *  radiator alone, and keeps the project's context so the copy reads as the project's does. Lives here, not in the base:
     *  the base cannot import the standalone subclass, which extends it (a circular import). */
    detach(): OpenISDPassiveRadiatorStandalone {
        return OpenISDPassiveRadiatorStandalone.wrapProjectCopy(this.clonePassiveRadiator(), this.projectContext);
    }
}
