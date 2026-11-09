import { entryField } from '../cell.js';
import type { Calculatable, Calculated, Clearable, Entered, Precise, Readable, SimpleField, Unsolvable, Writable } from '../cell.js';
import type { PassiveRadiatorSpecsSection, SpecEntryJson } from '../openisdSchema.js';
import type { DqIssue } from '../../engine/index.js';

/** The names of `PassiveRadiatorSpecsSection`'s spec-entry fields. */
export type PassiveRadiatorFieldName = keyof PassiveRadiatorSpecsSection;

/** One field of a radiator's section, entry-backed like a driver's: absent reads not-available,
 *  `E` reads entered, `C` reads calculated. Mms, Cms and Rms are written `C` by the project's
 *  resolve (`OpenIsdPassiveRadiatorSpec.resolve`). */
export function prSpec(
    section: SimpleField<PassiveRadiatorSpecsSection>,
    key: PassiveRadiatorFieldName,
    marks?: () => readonly DqIssue[],
    /** The stated fields an entered write to this one moves (typed last wins): dropped in the same write, then worked out again by `resolve`. */
    follows: () => readonly PassiveRadiatorFieldName[] = () => [],
    /** The entry the charts work out for this field, on demand; reads shadow the stored entry, writes still go to it. */
    shown?: () => SpecEntryJson | undefined,
): Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable {
    const slot: SimpleField<SpecEntryJson | undefined> = {
        get value() { return shown?.() ?? section.value[key]; },
        set: (entry) => { if (key === 'Cms_m_per_N') throw new Error('DBGF ' + JSON.stringify(entry));
            const {[key]: _removed, ...rest} = section.value;
            if (entry === undefined) { section.set(rest); return; }
            const next: {-readonly [K in PassiveRadiatorFieldName]?: SpecEntryJson} = {...section.value, [key]: entry};
            if (entry.state === 'E') for (const moved of follows()) if (next[moved]?.state === 'E') delete next[moved];
            section.set(next);
        },
    };
    return entryField(slot, key, marks);
}
