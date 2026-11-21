import {NumberField} from '../../fields/field.js';
import {simpleField, type SimpleField} from '../cell.js';
import {specEntryJsonSchema, type DriverDeviceJson, type DriverSpecsSection} from '../openisdSchema.js';
import {fieldLoadRule, repairLoaded, type LoadRepairNote, type LoadRepairRule} from '../project/loadRepair.js';
import {calculatedEntry} from '../specEntry.js';
import {driverSection} from './driverSection.js';

const DIMENSIONS = Object.freeze({
    Thick_m: NumberField.THICK_M,
    Depth_m: NumberField.DEPTH_M,
    MagDepth_m: NumberField.MAGDEPTH_M,
    Magnet_m: NumberField.MAGNET_M,
    Basket_m: NumberField.BASKET_M,
    Outer_m: NumberField.OUTER_M,
    OuterX_m: NumberField.OUTERX_M,
    OuterY_m: NumberField.OUTERY_M,
    Vcd_m: NumberField.VCD_M,
    DVol_m3: NumberField.DVOL_M3,
} satisfies Partial<Record<keyof DriverSpecsSection, NumberField>>);

export function isDriverDimension(key: keyof DriverSpecsSection): boolean {
    return Object.hasOwn(DIMENSIONS, key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sectionRules<T extends object>(section: SimpleField<T>, beforeValidation: boolean): LoadRepairRule[] {
    return Object.entries(DIMENSIONS).map(([key, field]) => fieldLoadRule(field, () => {
        const entry: unknown = Reflect.get(section.value, key);
        if (!isRecord(entry) || (entry.state !== 'E' && entry.state !== 'C') || typeof entry.value !== 'number') return null;
        // The strict schema rejects non-finite numbers. Repair those first when the rest of the
        // entry conforms, so unrelated schema errors still reach the normal validation path.
        if (beforeValidation && (Number.isFinite(entry.value) || !specEntryJsonSchema.safeParse({...entry, value: 0}).success)) return null;
        return entry.value;
    }, value => section.set({...section.value, [key]: value === null ? undefined : calculatedEntry(value)})));
}

/** Clear impossible geometry inputs before the solver reads them. Other dimensions take their
 *  minimum. Positive values survive opening, including values outside the editor's range. */
export function driverDimensionLoadRules(device: SimpleField<DriverDeviceJson>): LoadRepairRule[] {
    return (['woofer', 'tweeter'] as const).flatMap(name =>
        device.value.specs[name] === undefined ? [] : sectionRules(driverSection(device, name), false));
}

/** A JSON number can overflow on parsing, and a WinISD number can be non-finite. Apply the same
 *  rules before validation so these repairs can name the original value in the opening message. */
export function repairNonFiniteDriverDimensions(record: unknown): {record: unknown; notes: readonly LoadRepairNote[]} {
    if (!isRecord(record) || !isRecord(record.specs) || !isRecord(record.specs.woofer)) return {record, notes: []};
    const specs = {...record.specs};
    const rules = (['woofer', 'tweeter'] as const).flatMap(name => {
        const section = specs[name];
        if (!isRecord(section)) return [];
        let current = section;
        return sectionRules(simpleField(() => current, value => { current = value; specs[name] = value; }), true);
    });
    const notes = repairLoaded(rules);
    return {record: notes.length === 0 ? record : {...record, specs}, notes};
}
