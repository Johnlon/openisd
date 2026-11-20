import { NumberField } from '../../fields/field.js';
import type { ProvenanceLetter } from '../cell.js';
import { DRIVER_SPEC_FIELD_NAMES, type NumericDriverSpecFieldName } from './driverSpecFieldName.js';
import type { OpenISDDriver } from './openISDDriver.js';

/** One row of the driver summary (the library preview and the Driver tab's Info): a spec field
 *  the driver holds, its value and unit already formatted, and whether it is stated or calculated. */
export interface DriverInfoRow {
    readonly key: NumericDriverSpecFieldName;
    readonly label: string;
    /** The field's tooltip text. */
    readonly title: string;
    readonly value: string;
    readonly unit: string;
    readonly provenance: ProvenanceLetter;
}

/** A spec field with no `NumberField` of its own: its label and tooltip. */
interface RangeLabel {
    readonly label: string;
    readonly title: string;
}

/** The stated frequency range has no `NumberField` of its own; it is shown in Fs's unit. */
const RANGE_FIELDS: Readonly<Partial<Record<NumericDriverSpecFieldName, RangeLabel>>> = Object.freeze({
    freq_low_hz: Object.freeze({label: 'Range from', title: 'Frequency range, low end\nThe lowest frequency the maker states the driver is for.'}),
    freq_high_hz: Object.freeze({label: 'Range to', title: 'Frequency range, high end\nThe highest frequency the maker states the driver is for.'}),
});

/** The summary's first rows, the Thiele/Small set a reader looks for first; every other field
 *  follows in `DRIVER_SPEC_FIELD_NAMES` order. */
const LEADING: readonly NumericDriverSpecFieldName[] = Object.freeze([
    'Fs_hz', 'Qts', 'Qes', 'Qms', 'Re_ohm', 'BL_Tm', 'Le_H', 'Vas_m3', 'Sd_m2', 'Xmax_m', 'Pe_W', 'Znom_ohm', 'SPL_dB', 'EBP_hz',
]);

const ORDER: readonly NumericDriverSpecFieldName[] = Object.freeze([
    ...LEADING,
    ...DRIVER_SPEC_FIELD_NAMES
        .filter((n): n is NumericDriverSpecFieldName => n !== 'VCCon')
        .filter(n => !LEADING.includes(n)),
]);

/** Every numeric spec field `driver` holds, stated or calculated, formatted for display. A field
 *  with no value, or a value of 0 (a loaded 0 is an empty box), is left out. */
export function driverInfoRows(driver: OpenISDDriver): DriverInfoRow[] {
    const rows: DriverInfoRow[] = [];
    for (const key of ORDER) {
        const cell = driver.specField(key);
        const v = cell.value;
        if (v === null || !isFinite(v) || v === 0) continue;
        const field = NumberField.named(key);
        const range = RANGE_FIELDS[key];
        if (field !== undefined) {
            rows.push({key, label: field.label, title: field.description, value: field.format(v, cell.precision), unit: field.unitLabel(), provenance: cell.provenance});
        } else if (range !== undefined) {
            rows.push({key, label: range.label, title: range.title, value: NumberField.FS_HZ.format(v, cell.precision), unit: NumberField.FS_HZ.unitLabel(), provenance: cell.provenance});
        } else {
            throw new Error(`driverInfoRows: no display field for ${key}`);
        }
    }
    return rows;
}
