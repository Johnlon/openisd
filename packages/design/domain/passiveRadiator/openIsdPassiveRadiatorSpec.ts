import type { Calculatable, Calculated, Clearable, Entered, Precise, Readable, SimpleField, Unsolvable, Writable } from '../cell.js';
import type { Air, PrEngine, PrSpecValues } from '../../engine/index.js';
import type { RadiatorDeviceJson } from '../openisdSchema.js';
import { prSpec } from '../box/prSpec.js';
import { radiatorSection } from '../box/radiatorSection.js';

/**
 * ONE PASSIVE-RADIATOR SPEC SECTION, PUBLISHED — the radiator's counterpart to `DriverSpec`.
 *
 * A window onto the `passive-radiator` section of a device record, with every parameter that
 * section can carry. Separate from `DriverSpec` because a radiator has no motor: `Re`, `BL`,
 * `Qes`, `Znom`, `Pe` and the thermal parameters are not absent from it, they are meaningless to
 * it, and one shared class would have to model one of the two dishonestly.
 */
export class OpenIsdPassiveRadiatorSpec {
    readonly Fs_hz: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Qms: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Cms_m_per_N: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Mms_kg: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Rms_kg_per_s: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Sd_m2: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Vas_m3: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Vd_m3: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Xmax_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Xlim_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Dia_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Dd_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly DVol_m3: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Thick_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Depth_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Basket_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly Outer_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly OuterX_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly OuterY_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
    readonly weight_kg: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;

    constructor(slot: SimpleField<RadiatorDeviceJson>) {
        const section = radiatorSection(slot);
        this.Fs_hz = prSpec(section, 'Fs_hz');
        this.Qms = prSpec(section, 'Qms');
        this.Cms_m_per_N = prSpec(section, 'Cms_m_per_N');
        this.Mms_kg = prSpec(section, 'Mms_kg');
        this.Rms_kg_per_s = prSpec(section, 'Rms_kg_per_s');
        this.Sd_m2 = prSpec(section, 'Sd_m2');
        this.Vas_m3 = prSpec(section, 'Vas_m3');
        this.Vd_m3 = prSpec(section, 'Vd_m3');
        this.Xmax_m = prSpec(section, 'Xmax_m');
        this.Xlim_m = prSpec(section, 'Xlim_m');
        this.Dia_m = prSpec(section, 'Dia_m');
        this.Dd_m = prSpec(section, 'Dd_m');
        this.DVol_m3 = prSpec(section, 'DVol_m3');
        this.Thick_m = prSpec(section, 'Thick_m');
        this.Depth_m = prSpec(section, 'Depth_m');
        this.Basket_m = prSpec(section, 'Basket_m');
        this.Outer_m = prSpec(section, 'Outer_m');
        this.OuterX_m = prSpec(section, 'OuterX_m');
        this.OuterY_m = prSpec(section, 'OuterY_m');
        this.weight_kg = prSpec(section, 'weight_kg');
    }

    /** The seven figures of the radiator's T/S set that were typed or loaded, nothing derived. */
    #stated(): PrSpecValues {
        const stated = (f: Entered & Readable<number | null>): number | null => f.entered ? f.value : null;
        return {
            Fs_hz: stated(this.Fs_hz), Qms: stated(this.Qms), Vas_m3: stated(this.Vas_m3), Sd_m2: stated(this.Sd_m2),
            Mms_kg: stated(this.Mms_kg), Cms_m_per_N: stated(this.Cms_m_per_N), Rms_kg_per_s: stated(this.Rms_kg_per_s),
        };
    }

    /** Write every figure the stated ones derive onto its field as calculated, `air` being the
     *  project's. A stated figure is never touched; one nothing derives reads not-available. */
    resolve(pr: PrEngine, air: Air): void {
        const solved = pr.solveSpec(this.#stated(), air);
        const write = (field: Entered & Calculatable<number> & Unsolvable, value: number | null): void => {
            if (field.entered) return;
            if (value === null) field.setNotAvailable(); else field.setCalculated(value);
        };
        write(this.Fs_hz, solved.Fs_hz); write(this.Qms, solved.Qms); write(this.Vas_m3, solved.Vas_m3);
        write(this.Sd_m2, solved.Sd_m2); write(this.Mms_kg, solved.Mms_kg);
        write(this.Cms_m_per_N, solved.Cms_m_per_N); write(this.Rms_kg_per_s, solved.Rms_kg_per_s);
    }

    /** A record adopted into a project states Mms, Cms and Rms from its datasheet; where Fs, Qms,
     *  Vas and Sd alone derive one of them, it is demoted to calculated so the four drive it. A
     *  record stating only the mechanical set keeps it entered. */
    deriveFromWinisdFigures(pr: PrEngine, air: Air): void {
        const stated = this.#stated();
        const fromFour = pr.solveSpec({...stated, Mms_kg: null, Cms_m_per_N: null, Rms_kg_per_s: null}, air);
        const demote = (field: Entered & Calculatable<number>, derived: number | null): void => {
            if (field.entered && derived !== null) field.setCalculated(derived);
        };
        demote(this.Cms_m_per_N, fromFour.Cms_m_per_N);
        demote(this.Mms_kg, fromFour.Mms_kg);
        demote(this.Rms_kg_per_s, fromFour.Rms_kg_per_s);
    }
}
