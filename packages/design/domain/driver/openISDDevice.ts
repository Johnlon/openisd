import { Engine } from '../../engine/index.js';
import { SetOnlyFieldImpl, absentCell, enteredCell } from '../cell.js';
import type { Entered, Readable, SimpleField, Writable } from '../cell.js';
import { OpenISDDeviceJson } from '../openIsdDeviceJsonIo.js';

/** Schema-mandatory identity fields: always stated. */
type MandatoryMetaFieldName = 'brand' | 'model' | 'manufacturer';
/** Schema-optional identity fields: may be absent. */
type OptionalMetaFieldName = 'provided_by' | 'comment' | 'added';

/**
 * A DEVICE — a record describing one physical thing, with its identity and its provenance.
 *
 * A driver and a passive radiator are both devices. What they share is everything at this level:
 * a record (`OpenISDDeviceJson`), the six identity fields, and the engine every derived figure
 * comes from. What they do NOT share is the spec section their record carries, and therefore
 * every quantity in it — a radiator has no motor, so `Re`, `BL`, `Qes`, `Znom` and `Pe` are not
 * absent from it, they are meaningless to it.
 *
 * So identity lives here, once, and the physics lives in the subclass.
 */
export abstract class OpenISDDevice {
    #slot: SimpleField<OpenISDDeviceJson>;

    /** The one calculation surface. INJECTED, exactly as `OpenISDProject`'s is — a device reports
     *  derived figures, and every one of them comes from here and nowhere else. */
    protected readonly engine: Engine;

    readonly brand: Readable<string> & Entered & Writable<string>;
    readonly model: Readable<string> & Entered & Writable<string>;
    readonly manufacturer: Readable<string> & Entered & Writable<string>;
    readonly providedBy: Readable<string | null> & Entered & Writable<string>;
    readonly comment: Readable<string | null> & Entered & Writable<string>;
    readonly added: Readable<string | null> & Entered & Writable<string>;

    protected constructor(slot: SimpleField<OpenISDDeviceJson>, engine: Engine) {
        this.#slot = slot;
        this.engine = engine;
        this.brand = this.#buildMandatoryMeta('brand');
        this.model = this.#buildMandatoryMeta('model');
        this.manufacturer = this.#buildMandatoryMeta('manufacturer');
        this.providedBy = this.#buildOptionalMeta('provided_by');
        this.comment = this.#buildOptionalMeta('comment');
        this.added = this.#buildOptionalMeta('added');
    }

    /** The catalogue URL recorded for one source role — datasheet, product page, listing page —
     *  or null when the record carries none. The pickers show these as row and preview links,
     *  and the bundled index carries them; a URL is provenance, not a device parameter, so it is
     *  read here rather than off `spec`. */
    dataSource(role: 'manufacturer_datasheet' | 'manufacturer_product_page' | 'manufacturer_listing_page'): string | null {
        return this.#slot.value.data_sources.value[role] ?? null;
    }

    #buildMandatoryMeta(key: MandatoryMetaFieldName): Readable<string> & Entered & Writable<string> {
        return new SetOnlyFieldImpl<string>(
            () => enteredCell('', this.#slot.value[key].value),
            {
                entered: (v: string) => this.#slot.set({...this.#slot.value, [key]: {value: v, origin: 'entered'}}),
            },
        );
    }

    #buildOptionalMeta(key: OptionalMetaFieldName): Readable<string | null> & Entered & Writable<string> {
        return new SetOnlyFieldImpl<string, string | null>(
            () => {
                const stated = this.#slot.value[key];
                return stated === undefined
                    ? absentCell<string>('')
                    : enteredCell<string | null>('', stated.value);
            },
            {
                entered: (v: string) => this.#slot.set({...this.#slot.value, [key]: {value: v, origin: 'entered'}}),
            },
        );
    }
}
