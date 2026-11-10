import { realAppContext } from '../appContext.js';
import type { AppServices } from '../appContext.js';
import { asRadiatorDevice } from '../openisdSchema.js';
import { OpenISDDeviceJson } from '../openIsdDeviceJsonIo.js';
import type { RadiatorDeviceJson } from '../openisdSchema.js';
import type { Air, PrEngine, PrSpecIssue } from '../../engine/index.js';
import { blankDeviceRecord } from '../driver/blankDeviceRecord.js';
import { OpenISDPassiveRadiator } from './openISDPassiveRadiator.js';
import type { RadiatorContext } from './radiatorContext.js';
import { RadiatorAppContext } from './radiatorContext.js';
import type { RadiatorProjectContext } from './radiatorContext.js';

interface HeldRadiator {
    readonly read: () => RadiatorDeviceJson;
    readonly set: (json: RadiatorDeviceJson) => void;
}

/** A radiator record held in a variable. */
function heldRadiator(json: RadiatorDeviceJson): HeldRadiator {
    let current = json;
    return {read: () => current, set: (j) => { current = j; }};
}

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
    static empty(appContext: AppServices = realAppContext): OpenISDPassiveRadiatorStandalone {
        return OpenISDPassiveRadiatorStandalone.wrap(blankDeviceRecord({'passive-radiator': {}}, 'passive-radiator', appContext));
    }

    static fromConformingRecord(record: unknown): OpenISDPassiveRadiatorStandalone | string[] {
        const conformed = OpenISDDeviceJson.fromConformingRecord(record);
        if ('problems' in conformed) return conformed.problems;

        const radiator = asRadiatorDevice(conformed.json);
        if (radiator === null) return ['no passive-radiator section — this record is a driver, not a radiator'];
        return OpenISDPassiveRadiatorStandalone.wrap(radiator);
    }



    private constructor(
        read: () => RadiatorDeviceJson,
        set: (json: RadiatorDeviceJson) => void,
        conflicts: () => readonly PrSpecIssue[],
        context: RadiatorContext,
        private readonly noteConflicts: (issues: readonly PrSpecIssue[]) => void,
    ) {
        super({get value() { return read(); }, set}, conflicts, context);
    }

    /** A radiator the app manages outside any project: it shows its datasheet. */
    static wrap(json: RadiatorDeviceJson): OpenISDPassiveRadiatorStandalone {
        return OpenISDPassiveRadiatorStandalone.#over(heldRadiator(json), RadiatorAppContext.of());
    }

    /** A copy of a project's radiator: it is read with the project's context. */
    static wrapProjectCopy(json: RadiatorDeviceJson, context: RadiatorProjectContext): OpenISDPassiveRadiatorStandalone {
        return OpenISDPassiveRadiatorStandalone.#over(heldRadiator(json), context);
    }

    static #over(held: HeldRadiator, context: RadiatorContext): OpenISDPassiveRadiatorStandalone {
        let issues: readonly PrSpecIssue[] = [];
        return new OpenISDPassiveRadiatorStandalone(held.read, held.set, () => issues, context, (found) => {
            issues = found;
        });
    }

    /** Fill every figure the stated ones give and mark the stated ones that contradict each other,
     *  for a radiator being edited outside a project (the New Project wizard's copy). */
    resolve(pr: PrEngine, air: Air): void {
        this.noteConflicts(this.spec.resolve(pr, air));
    }
}
