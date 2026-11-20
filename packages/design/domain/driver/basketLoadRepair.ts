import {NumberField} from '../../fields/field.js';
import {focus, type SimpleField} from '../cell.js';
import type {DriverDeviceJson} from '../openisdSchema.js';
import {fieldLoadRule} from '../project/loadRepair.js';
import type {LoadRepairRule} from '../project/loadRepair.js';
import {calculatedEntry} from '../specEntry.js';
import {driverSection} from './driverSection.js';

/** Apply the general load repair to the woofer basket slot. */
export function basketLoadRule(device: SimpleField<DriverDeviceJson>): LoadRepairRule {
    const field = NumberField.BASKET_M;
    const slot = focus(driverSection(device, 'woofer'), 'Basket_m');
    const loaded = (): number | null => {
        const entry = slot.value;
        return entry === undefined || entry.state === 'N' ? null : entry.value;
    };
    return fieldLoadRule(field, loaded, value => {
        if (value === null) throw new Error('Basket Diameter repairs to a number');
        slot.set(calculatedEntry(value));
    });
}
