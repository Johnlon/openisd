import {type Engine} from '../../engine/index.js';
import type { DriverIssue } from '../../engine/index.js';
import type { SimpleField } from '../cell.js';
import type { DriverDeviceJson } from '../openisdSchema.js';
import { OpenISDDriver } from './openISDDriver.js';
import type { DriverContext } from './driverContext.js';
import { NULL_GUID } from '../project/nullDriverId.js';

/** The driver INSIDE a project — a window onto the project's own `driver` slot. A standalone
 *  driver windows its own record instead, which is the whole difference between the two.
 *
 *  Its calculations use the project's air (John, 2026-10-05); its `c`/`roo` show that air. */
export class OpenISDDriverEmbedded extends OpenISDDriver {
    private constructor(
        record: SimpleField<DriverDeviceJson>,
        engine: Engine,
        context: DriverContext,
        durableIssues: () => readonly DriverIssue[],
        private readonly newId: () => string,
    ) {
        super(record, engine, context, durableIssues);
    }

    /** Takes the lens onto the project's `driver` slot and the project's context (its air and "Cms from Vas" choice), which this driver and
     *  every copy of it use. The project builds it, so the driver needs no reference back to the project itself. */
    static wrap(
        slot: SimpleField<DriverDeviceJson>,
        engine: Engine,
        context: DriverContext,
        /** The PROJECT's cached driver issues. This object does not outlive one access, so the
         *  dq a resolve wrote into its fields is gone before anything reads it; the project's
         *  cache is what survives. */
        durableIssues: () => readonly DriverIssue[],
        /** The app's id source: a driver leaving the project becomes an entity and gets an id. */
        newId: () => string,
    ): OpenISDDriverEmbedded {
        return new OpenISDDriverEmbedded(slot, engine, context, durableIssues, newId);
    }

    protected idForCopy(): string {
        return this.newId();
    }

    protected idAfterAdopting(): string {
        return NULL_GUID;
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
