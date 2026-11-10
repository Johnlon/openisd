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
    marks: (() => readonly DqIssue[]) | undefined,
    /** The stated fields an entered write to this one moves (typed last wins): dropped in the same write, then worked out again by `resolve`. */
    follows: () => readonly PassiveRadiatorFieldName[],
): SpecField {
    return typedPrSpec(section, key, marks, follows, NOTHING_TYPED);
}

/** `prSpec` that also tells `typed` the value of every entered write (the Cms or Mms the charts then follow). */
export function typedPrSpec(
    section: SimpleField<PassiveRadiatorSpecsSection>,
    key: PassiveRadiatorFieldName,
    marks: (() => readonly DqIssue[]) | undefined,
    follows: () => readonly PassiveRadiatorFieldName[],
    typed: (value: number) => void,
): SpecField {
    return entryField(storedSlot(section, key, follows, typed), key, marks);
}

/** A field whose typing records nothing about which figure the charts follow. */
const NOTHING_TYPED = (_value: number): void => undefined;

/** `prSpec` for a figure the box shows as the engine works it out (`shown`): reads shadow the stored entry, writes still go to it. */
export function shownPrSpec(
    section: SimpleField<PassiveRadiatorSpecsSection>,
    key: PassiveRadiatorFieldName,
    marks: (() => readonly DqIssue[]) | undefined,
    follows: () => readonly PassiveRadiatorFieldName[],
    shown: () => SpecEntryJson | undefined,
    typed: (value: number) => void,
): SpecField {
    const stored = storedSlot(section, key, follows, typed);
    const slot: SimpleField<SpecEntryJson | undefined> = {
        get value() { return shown() ?? stored.value; },
        set: (entry) => stored.set(entry),
    };
    return entryField(slot, key, marks);
}

type SpecField = Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;

/** `key`'s entry in the section, as stored. An entered write drops the stated fields `follows` names in the same write. */
function storedSlot(
    section: SimpleField<PassiveRadiatorSpecsSection>,
    key: PassiveRadiatorFieldName,
    follows: () => readonly PassiveRadiatorFieldName[],
    typed: (value: number) => void,
): SimpleField<SpecEntryJson | undefined> {
    return {
        get value() { return section.value[key]; },
        set: (entry) => {
            const {[key]: _removed, ...rest} = section.value;
            if (entry === undefined) { section.set(rest); return; }
            const next: {-readonly [K in PassiveRadiatorFieldName]?: SpecEntryJson} = {...section.value, [key]: entry};
            if (entry.state === 'E') {
                for (const moved of follows()) if (next[moved]?.state === 'E') delete next[moved];
                typed(entry.value);
            }
            section.set(next);
        },
    };
}
