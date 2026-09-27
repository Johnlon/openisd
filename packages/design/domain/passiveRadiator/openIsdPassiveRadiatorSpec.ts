import type { Calculatable, Calculated, Clearable, Entered, Precise, Readable, SimpleField, Unsolvable, Writable } from '../cell.js';
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
}
