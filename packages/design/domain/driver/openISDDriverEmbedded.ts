import {type Engine} from '../../engine/index.js';
import type { AirState, DriverIssue } from '../../engine/index.js';
import type { SimpleField } from '../cell.js';
import type { DriverDeviceJson } from '../openisdSchema.js';
import { OpenISDDriver, OpenISDDriverStandalone } from './openISDDriver.js';
import { NULL_GUID } from '../project/nullDriverId.js';

/** The driver INSIDE a project — a window onto the project's own `driver` slot. A standalone
 *  driver windows its own record instead, which is the whole difference between the two.
 *
 *  Its calculations use the project's air (John, 2026-10-05); its `c`/`roo` show that air. */
export class OpenISDDriverEmbedded extends OpenISDDriver {
    private constructor(
        record: SimpleField<DriverDeviceJson>,
        engine: Engine,
        airProvider: () => AirState,
        durableIssues: () => readonly DriverIssue[],
        private readonly newId: () => string,
    ) {
        super(record, engine, airProvider, durableIssues);
    }

    /** Takes the lens onto the project's `driver` slot and the project's air — the air every
     *  calculation of this driver uses. The project builds both, so the
     *  driver needs no reference back to the project itself. */
    static wrap(
        slot: SimpleField<DriverDeviceJson>,
        engine: Engine,
        airProvider: () => AirState,
        /** The PROJECT's cached driver issues. This object does not outlive one access, so the
         *  dq a resolve wrote into its fields is gone before anything reads it; the project's
         *  cache is what survives. */
        durableIssues: () => readonly DriverIssue[],
        /** The app's id source: a driver leaving the project becomes an entity and gets an id. */
        newId: () => string,
    ): OpenISDDriverEmbedded {
        return new OpenISDDriverEmbedded(slot, engine, airProvider, durableIssues, newId);
    }

    /** A standalone copy of this driver with a NEW id: the driver in a project has no id of its
     *  own, and what leaves the project (to My Drivers, or into an editor that will save it) is
     *  a different driver from any other copy of it. */
    detach(): OpenISDDriverStandalone {
        const copy = this.cloneDriver();
        copy.uuid = {value: this.newId()};
        return OpenISDDriverStandalone.wrap(copy, this.engine);
    }

    /** Adopt `source`'s values; the id of `source` is not kept, the project's driver has none. */
    override update(source: OpenISDDriver): void {
        super.update(source);
        this.record.set({...this.record.value, uuid: {...this.record.value.uuid, value: NULL_GUID}});
    }

    /** Re at the project's voice-coil temperature rise — the Re WinISD drives from — when Re is a
     *  positive finite number, else null. The coefficient and the rise are the project's, not the
     *  driver record's (bugs/archive/BUG_20260928_vc-temperature-drive-uses-hot-re.md). */
    hotRe_ohm(alfaVC_per_K: number, dT_K: number): number | null {
        // The Re the amplifier sees: a multi-coil driver's wiring changes it.
        const Re_ohm = this.specs.solverParams().Re_terminal_ohm.value;
        return Re_ohm !== null && Number.isFinite(Re_ohm) && Re_ohm > 0 ? this.engine.driver.hotRe(Re_ohm, alfaVC_per_K, dT_K) : null;
    }
}
