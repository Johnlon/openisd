import type { SimpleField } from '../cell.js';
import type { PrSpecIssue } from '../../engine/index.js';
import { CURRENT_SCHEMA_VERSION } from '../schemaVersion.js';
import type { RadiatorDeviceJson } from '../openisdSchema.js';
import { OpenISDDevice } from '../driver/openISDDevice.js';
import { OpenIsdPassiveRadiatorSpec } from './openIsdPassiveRadiatorSpec.js';
import type { RadiatorContext } from './radiatorContext.js';

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

    /** What this radiator is read with: the project's air and "Cms from Vas" choice, or its datasheet outside a project.
     *  Required: a copy that leaves a project (`detach()`) passes it on, so it reads as the project's radiator does. */
    protected readonly context: RadiatorContext;

    protected constructor(slot: SimpleField<RadiatorDeviceJson>, conflicts: () => readonly PrSpecIssue[], context: RadiatorContext) {
        super(slot);
        this.slot = slot;
        this.context = context;
        this.spec = new OpenIsdPassiveRadiatorSpec(slot, conflicts, context);
    }

    /**
     * Replace this radiator's record with `source`'s current values. Declared HERE because `slot`
     * is declared here, which is what makes reading `source.slot` legal.
     */
    update(source: OpenISDPassiveRadiator): void {
        this.slot.set({...source.slot.value});
    }

    /** The stable identity carried by the canonical record — the radiator's counterpart to
     *  `OpenISDDriver.uuid()`. The bundled index lists radiators by it and favourites key on it. */
    uuid(): string {
        return this.slot.value.uuid.value;
    }

    /** @internal The record a save writes, deep-cloned — the radiator's counterpart to
     *  `OpenISDDriver.cloneDriver()`, and the persistence layer's one way to reach the raw
     *  record it stores, never field by field. Clones before handing it out, so the caller can
     *  store the result without aliasing this radiator's own live record. */
    clonePassiveRadiator(): RadiatorDeviceJson {
        return {...structuredClone(this.slot.value), schemaVersion: CURRENT_SCHEMA_VERSION};
    }

    /** The record as the app holds it — the radiator's counterpart of `OpenISDDriver.toOpenIsdDeviceJson()`.
     *  Un-cloned, like the driver's: a caller that stores it clones it (`clonePassiveRadiator()`). */
    toOpenIsdDeviceJson(): RadiatorDeviceJson {
        return this.slot.value;
    }
}
