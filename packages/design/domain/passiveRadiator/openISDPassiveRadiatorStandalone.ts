import { Engine } from '../../engine/index.js';
import { realAppContext } from '../appContext.js';
import type { AppContext } from '../appContext.js';
import { OpenISDDeviceJson, asRadiatorDevice } from '../openisdSchema.js';
import type { RadiatorDeviceJson } from '../openisdSchema.js';
import { blankDeviceRecord } from '../driver/blankDeviceRecord.js';
import { OpenISDPassiveRadiator } from './openISDPassiveRadiator.js';

/** A radiator that belongs to no box — straight out of the bundle, or served from My PRs. The
 *  ONLY radiator type the selector popup and the PR editor ever see, and what `configurePR()`
 *  accepts. Its record has a `passive-radiator` section. Its
 *  own concept, not "a driver that happens to be a PR": no shared ancestor with `OpenISDDriver`.
 *  Same window-not-copy shape, same construction-time refusal, same eager-built fields.
 *
 *  `export`ed for `openisdTransforms.ts` (`conformingRecordToOpenIsdPassiveRadiatorStandalone`
 *  and the PR builder call `wrap()`); `domain/index.ts` does not re-export it. */
export class OpenISDPassiveRadiatorStandalone extends OpenISDPassiveRadiator {
    /** A radiator stating nothing — the counterpart of `OpenISDDriver.empty()`, and how a PR
     *  comes into existence before anyone has typed its parameters. `configurePR()` accepts it,
     *  so a box can adopt one and the editor fills it in from there. */
    static empty(engine: Engine, appContext: AppContext = realAppContext): OpenISDPassiveRadiatorStandalone {
        return OpenISDPassiveRadiatorStandalone.wrap(blankDeviceRecord({'passive-radiator': {}}, 'passive-radiator', appContext), engine);
    }

    static fromConformingRecord(record: unknown, engine: Engine): OpenISDPassiveRadiatorStandalone | string[] {
        const conformed = OpenISDDeviceJson.fromConformingRecord(record);
        if ('problems' in conformed) return conformed.problems;

        const radiator = asRadiatorDevice(conformed.json);
        if (radiator === null) return ['no passive-radiator section — this record is a driver, not a radiator'];
        return OpenISDPassiveRadiatorStandalone.wrap(radiator, engine);
    }



    private constructor(
        read: () => RadiatorDeviceJson,
        set: (json: RadiatorDeviceJson) => void,
        engine: Engine,
    ) {
        super({get value() { return read(); }, set}, engine);
    }

    static wrap(json: RadiatorDeviceJson, engine: Engine): OpenISDPassiveRadiatorStandalone {
        let current = json;
        return new OpenISDPassiveRadiatorStandalone(() => current, (j) => {
            current = j;
        }, engine);
    }

    /** @internal The record a save writes, deep-cloned — the radiator's counterpart to
     *  `OpenISDDriver.cloneDriver()`, and the persistence layer's one way to reach the raw
     *  record it stores, never field by field. Clones before handing it out, so the caller can
     *  store the result without aliasing this radiator's own live record. */
    clonePassiveRadiator(): RadiatorDeviceJson {
        return structuredClone(this.slot.value);
    }

    /** The record as the app holds it — the radiator's counterpart of `OpenISDDriver.toOpenIsdDeviceJson()`,
     *  so the scraper bridge and the bundler's round-trip gate read a radiator through the same
     *  seam a driver has. Un-cloned, like the driver's: a caller that stores it clones it
     *  (`clonePassiveRadiator()`). */
    toOpenIsdDeviceJson(): RadiatorDeviceJson {
        return this.slot.value;
    }

}
