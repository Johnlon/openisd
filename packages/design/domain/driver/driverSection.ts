import type { SimpleField } from '../cell.js';
import type { DriverDeviceJson, DriverSpecsSection } from '../openisdSchema.js';

/** One spec section of `record`. An absent tweeter section reads empty and is created on write. */
export function driverSection(record: SimpleField<DriverDeviceJson>, section: 'woofer' | 'tweeter'): SimpleField<DriverSpecsSection> {
    return {
        get value() { return record.value.specs[section] ?? {}; },
        set: (next) => record.set({...record.value, specs: {...record.value.specs, [section]: next}}),
    };
}
