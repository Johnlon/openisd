import { dateStamp } from '../appContext.js';
import type { AppContext } from '../appContext.js';
import { newUuid } from '../newUuid.js';
import { OpenISDDeviceJson } from '../openIsdDeviceJsonIo.js';
import type { DriverSpecsJson, RadiatorSpecsJson } from '../openisdSchema.js';

/**
 * A device record stating NOTHING but its own bookkeeping and its provenance — what `empty()`
 * hands an editor.
 *
 * Every spec section is absent, so each field reads `not-available` and the editor's own
 * "not entered" rendering is what the user sees. The bookkeeping fields cannot be absent: the
 * conformance guard requires them, so a record without them is not a record and could never be
 * saved. They are minted the way a `.wdr` import mints them (`openisdSchema.ts`
 * `wdrToOpenIsdRecord`), which faces the same problem — a record with no source document
 * behind it.
 *
 * `added` and `provided_by` are the one exception to "nothing but bookkeeping": a freshly
 * created device DOES have a creation date and, when the platform user is known, a creator —
 * facts about this act of creation, not about the device's physical spec.
 */
export function blankDeviceRecord<S extends DriverSpecsJson | RadiatorSpecsJson>(
    specs: S, section: 'woofer' | 'passive-radiator', appContext: AppContext,
): Omit<OpenISDDeviceJson, 'specs'> & {specs: S} {
    const platformUser = appContext.platformUser();
    return {
        uuid: {value: newUuid()},
        quality: {
            confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
            parse_errors: [], cross_source_only: [],
        },
        // Stated as empty rather than omitted: the guard requires all three, and an editor
        // overwrites them the moment the user types. `Field`'s own reader reports an empty
        // string as `not-available`, so a blank still renders blank.
        manufacturer: {value: ''},
        brand: {value: ''},
        model: {value: ''},
        sku: {value: '', grounds: [{origin: 'manual', reading: ''}]},
        data_sources: {value: {}},
        driver_type: {value: section},
        specs,
        added: {value: dateStamp(appContext.now()), origin: 'entered'},
        // Omitted, not `''`, when nobody is known — `#buildMeta` reads a missing key as absent.
        ...(platformUser !== null ? {provided_by: {value: platformUser, origin: 'entered'}} : {}),
    };
}
