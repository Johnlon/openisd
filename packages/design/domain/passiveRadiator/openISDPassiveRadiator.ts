import type { SimpleField } from '../cell.js';
import type { RadiatorDeviceJson } from '../openisdSchema.js';
import { OpenISDDevice } from '../driver/openISDDevice.js';
import { OpenIsdPassiveRadiatorSpec } from './openIsdPassiveRadiatorSpec.js';

/**
 * What every radiator has, wherever the radiator lives: a lens onto ITS OWN record.
 *
 * `slot` is PROTECTED, so `update()` below — a method of the class that declares it — may read
 * `source.slot`, while nothing outside the class hierarchy can.
 */
export abstract class OpenISDPassiveRadiator extends OpenISDDevice {
    protected readonly slot: SimpleField<RadiatorDeviceJson>;

    /** Which spec section this device's record carries — the radiator's counterpart to the
     *  driver's `'woofer' | 'tweeter'`. */
    readonly section = 'passive-radiator' as const;

    /** This radiator's spec section, exactly as a driver publishes `spec[section]`. */
    readonly spec: OpenIsdPassiveRadiatorSpec;


    // Every SPEC field a radiator can state, declared and built ONCE for both kinds. An embedded
    // radiator and a standalone one differ in WHERE their record lives, never in what a radiator
    // is, so a field list that differed between them was describing nothing real. The six identity
    // fields are not here: every device has those, so they live on `OpenISDDevice`.

    protected constructor(slot: SimpleField<RadiatorDeviceJson>) {
        super(slot);
        this.slot = slot;
        this.spec = new OpenIsdPassiveRadiatorSpec(slot);
    }

    /**
     * Replace this radiator's record with `source`'s current values.
     *
     * PROTECTED: adopting another radiator is meaningless on a standalone, which belongs to no
     * box, so only the embedded subclass republishes this as public. Declared HERE because `slot`
     * is declared here, which is what makes reading `source.slot` legal.
     */
    protected update(source: OpenISDPassiveRadiator): void {
        this.slot.set({...source.slot.value});
    }

    /** The stable identity carried by the canonical record — the radiator's counterpart to
     *  `OpenISDDriver.uuid()`. The bundled index lists radiators by it and favourites key on it. */
    uuid(): string {
        return this.slot.value.uuid.value;
    }
}
