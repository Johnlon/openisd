import { Engine } from '../../engine/index.js';
import type { AirEnvironment, DriverIssue } from '../../engine/index.js';
import type { SimpleField } from '../cell.js';
import type { DriverDeviceJson } from '../openisdSchema.js';
import { OpenISDDriver, OpenISDDriverStandalone } from './openISDDriver.js';

/** The driver INSIDE a project — a window onto the project's own `driver` slot. A standalone
 *  driver windows its own record instead, which is the whole difference between the two.
 *
 *  An embedded driver never carries its own stored `c`/`roo`: the project's environment is the
 *  sole source while it is embedded (human ruling 2026-09-15). `update()` strips both fields on
 *  every write, `solveConsistencyGroup()` fills them from the project's live environment, and
 *  `detach()` freezes the resolved pair back in as entered so the driver leaves with a concrete
 *  value instead of reverting to the bare reference default. */
export class OpenISDDriverEmbedded extends OpenISDDriver {
    private constructor(
        record: SimpleField<DriverDeviceJson>,
        engine: Engine,
        airProvider: () => AirEnvironment,
        durableIssues: () => readonly DriverIssue[],
    ) {
        super(record, engine, airProvider, durableIssues);
    }

    /** Takes the lens onto the project's `driver` slot and the project's air — what this driver
     *  falls back to when it states no `c`/`roo` of its own. The project builds both, so the
     *  driver needs no reference back to the project itself. */
    static wrap(
        slot: SimpleField<DriverDeviceJson>,
        engine: Engine,
        airProvider: () => AirEnvironment,
        /** The PROJECT's cached driver issues. This object does not outlive one access, so the
         *  dq a resolve wrote into its fields is gone before anything reads it; the project's
         *  cache is what survives. */
        durableIssues: () => readonly DriverIssue[],
    ): OpenISDDriverEmbedded {
        return new OpenISDDriverEmbedded(slot, engine, airProvider, durableIssues);
    }

    /** Adopt `source`'s whole record, then strip its `c`/`roo` — an embedded driver never keeps
     *  an imported/entered value of its own, regardless of where the write came from (a project
     *  choosing a different driver, loading a `.wdr`/`.owdr`, or the generic editor's commit path,
     *  which all route through this one method). */
    override update(source: OpenISDDriver): void {
        super.update(source);
        this.specs.c_m_per_s.clear();
        this.specs.roo_kg_per_m3.clear();
    }

    /** S2-10: `solveConsistencyGroup()` — the what-if bag query this class used to override to
     *  force `c`/`roo` to the project's live air regardless of the stored pair — is gone; the
     *  record is read directly everywhere now (`driver.ts.c_m_per_s.value`), so masking a stale
     *  value at READ time is no longer possible. Clearing it here, on every `resolve()` (not just
     *  on `update()`), is what keeps the "project environment is the SOLE source while embedded"
     *  guarantee self-healing: a write that bypasses `setDriver()`/`loadDriver()` entirely (a
     *  project record saved before this rule existed, `fromOwprText` loading it back, or a
     *  direct field write) can still leave `c_m_per_s`/`roo_kg_per_m3` 'entered' in the raw
     *  record, and `resolve()` never overwrites an entered value on its own — so without this,
     *  such a record's stale pair would surface again (test/domain.test.ts "a stale c/roo
     *  already sitting in an embedded driver's record… is still ignored"). */
    override resolve(): readonly DriverIssue[] {
        this.specs.c_m_per_s.clear();
        this.specs.roo_kg_per_m3.clear();
        return super.resolve();
    }

    /** Leaving the project: freeze the currently-resolved `c`/`roo` in as entered on the detached
     *  copy, so the driver's behaviour does not jump the instant it is no longer bound to a
     *  project's environment. */
    override detach(): OpenISDDriverStandalone {
        // The record's own resolve() cascade (S2-7c/d1) already derives `c_m_per_s`/
        // `roo_kg_per_m3` from the base class's own `airProvider` — this embedded driver's OWN
        // stored pair is always stripped (`update()` above), so the cascade never has an entered
        // value of its own to prefer and always falls through to the project's live environment.
        // Reading the record directly is therefore already "the project's resolved air" — no
        // bag override needed (S2-10).
        const resolvedC = this.specs.c_m_per_s.value;
        const resolvedRho = this.specs.roo_kg_per_m3.value;
        const copy = super.detach();
        if (resolvedC !== null) copy.specs.c_m_per_s.set(resolvedC);
        if (resolvedRho !== null) copy.specs.roo_kg_per_m3.set(resolvedRho);
        return copy;
    }
}
