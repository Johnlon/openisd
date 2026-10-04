import { entryField } from '../cell.js';
import type { Calculatable, Calculated, Clearable, Entered, Precise, Readable, SimpleField, Unsolvable, Writable } from '../cell.js';
import type { PassiveRadiatorSpecsSection, SpecEntryJson } from '../openisdSchema.js';
import type { DqIssue } from '../../engine/index.js';

/** The names of `PassiveRadiatorSpecsSection`'s spec-entry fields. */
type PassiveRadiatorFieldName = keyof PassiveRadiatorSpecsSection;

/** One field of a radiator's section, entry-backed like a driver's: absent reads not-available,
 *  `E` reads entered, `C` reads calculated. Mms, Cms and Rms are written `C` by the project's
 *  resolve (`OpenIsdPassiveRadiatorSpec.resolve`). */
export function prSpec(
    section: SimpleField<PassiveRadiatorSpecsSection>,
    key: PassiveRadiatorFieldName,
    marks?: () => readonly DqIssue[],
): Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable {
    const slot: SimpleField<SpecEntryJson | undefined> = {
        get value() { return section.value[key]; },
        set: (entry) => {
            const {[key]: _removed, ...rest} = section.value;
            section.set(entry === undefined ? rest : {...section.value, [key]: entry});
        },
    };
    return entryField(slot, key, marks);
}
