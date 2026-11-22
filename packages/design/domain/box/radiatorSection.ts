import type { SimpleField } from '../cell.js';
import type { PassiveRadiatorSpecsSection, RadiatorDeviceJson } from '../openisdSchema.js';

/** The radiator section of `slot`'s record. */
export function radiatorSection(slot: SimpleField<RadiatorDeviceJson>): SimpleField<PassiveRadiatorSpecsSection> {
    return {
        get value() { return slot.value.specs['passive-radiator']; },
        set: (section) => slot.set({...slot.value, specs: {'passive-radiator': section}}),
    };
}
