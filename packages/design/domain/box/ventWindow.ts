import { Engine } from '../../engine/index.js';
import type { Air } from '../../engine/index.js';
import { defaultingEntryField, entryField, focus, nullableField, pairedField } from '../cell.js';
import type { Calculatable, Calculated, Clearable, Entered, Precise, Readable, SimpleField, Unsolvable, Writable } from '../cell.js';
import { calcVentCount } from '../openisdSchema.js';
import type { VentJson } from '../openisdSchema.js';
import type { Vent, VentShape } from '../vent.js';

/** One port. `area_m2` follows `shape` — a solved pair with `diameter_m` when round, with
 *  `height_m` (against the live `width_m`) when slotted — so switching shape changes which pair
 *  is active without any stored value having to be recomputed or migrated. */
export class VentWindow implements Vent {
    readonly #lens: SimpleField<VentJson>;
    readonly #engine: Engine;
    /** The project's own resolved air, read at CALL time — never a reference-condition default
     *  computed inside the engine (Driver Air Constants,
     *  `docs/plans/PLAN_DRIVER_SOLVE_AND_SWEEP_DIAGNOSTICS.md`). Sourced from the owning box's
     *  embedded driver, which already resolves `c_m_per_s`/`roo_kg_per_m3` to the project's live
     *  environment unconditionally — no second air-provider plumbing needed. */
    readonly #air: () => Air;
    readonly shape: SimpleField<VentShape>;
    readonly endCorrection_m: SimpleField<number>;

    readonly diameter_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly width_m: Readable<number | null> & Entered & Writable<number> & Clearable;
    readonly height_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly length_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly count: Readable<number> & Entered & Calculated & Writable<number> & Clearable & Calculatable<number>;
    readonly area_m2: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;

    constructor(
        lens: SimpleField<VentJson>, engine: Engine, air: () => Air,
        /** A pre-built `length_m`, ATOMICALLY paired with a tuning target living OUTSIDE this
         *  vent's own record (a chamber's `tuning_goal_hz` — `vented`'s and `bandpass4.front`'s own
         *  vents have one; bandpass6/ABC's do not, so they pass none). Only the OWNER
         *  (`OpenISDBox`) can build this: it is the one place that can see both parent lenses at
         *  once, needed to write BOTH sides in a single call — two separate writes would let a
         *  resolve run in between and re-derive the sibling from a value the caller is in the
         *  middle of retracting (S2-7d2 — replaces the earlier `ventContext` bag, which fed a
         *  live read-time solve `#resolve()` now owns). */
        lengthField?: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable,
    ) {
        this.#lens = lens;
        this.#engine = engine;
        this.#air = air;
        this.shape = focus(lens, 'shape');
        this.endCorrection_m = focus(lens, 'endCorrection_m');
        this.width_m = nullableField(lens, 'width_m');
        this.length_m = lengthField ?? entryField(focus(lens, 'length_m'), 'length_m', engine);

        // Two solved pairs sharing this one record: `diameter_m` ↔ `area_m2` (round), `height_m`
        // ↔ `area_m2` (slotted, against the live `width_m`) — `#resolveVentGeometry` runs the
        // actual Math. `area_m2`'s own commit picks its sibling by the CURRENT shape; entering
        // `diameter_m`/`height_m` always clears `area_m2` unconditionally — harmless when that
        // dimension is not the active one, since geometry never consults it either.
        const diameterEntry = entryField(focus(lens, 'diameter_m'), 'diameter_m', engine);
        const heightEntry = entryField(focus(lens, 'height_m'), 'height_m', engine);
        const areaEntry = entryField(focus(lens, 'area_m2'), 'area_m2', engine);
        this.diameter_m = pairedField(
            (entry) => lens.set({ ...lens.value, diameter_m: entry, area_m2: undefined }),
            diameterEntry,
        );
        this.height_m = pairedField(
            (entry) => lens.set({ ...lens.value, height_m: entry, area_m2: undefined }),
            heightEntry,
        );
        this.area_m2 = pairedField(
            (entry) => {
                if (lens.value.shape === 'round') lens.set({ ...lens.value, area_m2: entry, diameter_m: undefined });
                else lens.set({ ...lens.value, area_m2: entry, height_m: undefined });
            },
            areaEntry,
        );

        /** Never N: an empty slot reads `calcVentCount()` as C; `OpenISDProject#resolveVentCount`
         *  stores it. */
        this.count = defaultingEntryField(focus(lens, 'count'), 'count', engine, calcVentCount);
    }

    /** The port count as a plain number. A record the resolve has not reached, or one stating a
     *  count that is not a whole number of at least one, reads as the default — REPAIRED rather
     *  than refused (John 2026-09-20). */
    #ports(): number {
        return this.count.value;
    }

    /** `count` × one port's area — plain arithmetic on geometry the domain already owns. */
    totalArea_m2(): number | null {
        const one = this.area_m2.value;
        return one === null ? null : this.#ports() * one;
    }

    /** Acoustic length — the physical length plus the end correction, which is what the sweep's
     *  port model actually resonates (`SweepParams.Leff`).
     *
     *  The end correction models how air outside the port behaves, so it is ACOUSTICS and the
     *  engine owns it. The domain supplies the port's own geometry — its length and its area, both
     *  of which it legitimately knows — and reports what comes back. */
    effectiveLength_m(): number | null {
        const length_m = this.length_m.value;
        const Sp = this.area_m2.value;
        if (length_m === null || Sp === null) return null;
        return this.#engine.ventEffectiveLength(length_m, Sp, this.#ports(), this.#lens.value.endCorrection_m);
    }

    tuningIn_hz(volume_m3: number | null): number | null {
        const length_m = this.length_m.value;
        const Sp = this.area_m2.value;
        if (volume_m3 === null || !(volume_m3 > 0) || length_m === null || Sp === null) return null;
        return this.#engine.tuningFromLength(volume_m3, length_m, Sp, this.#ports(), this.#air(), this.#lens.value.endCorrection_m);
    }

    lengthForTuning_m(volume_m3: number | null, fb_hz: number): number | null {
        const Sp = this.area_m2.value;
        if (volume_m3 === null || !(volume_m3 > 0) || !(fb_hz > 0) || Sp === null) return null;
        return this.#engine.ventLength(volume_m3, fb_hz, Sp, this.#ports(), this.#air(), this.#lens.value.endCorrection_m);
    }
}
