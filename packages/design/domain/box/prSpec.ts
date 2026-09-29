import { DualWriteFieldImpl, absentCell, enteredCell } from '../cell.js';
import type { Calculatable, Calculated, Clearable, Entered, Precise, Readable, SimpleField, Unsolvable, Writable } from '../cell.js';
import { enteredEntry } from '../specEntry.js';
import type { PassiveRadiatorSpecsSection } from '../openisdSchema.js';

/** The names of `PassiveRadiatorSpecsSection`'s spec-entry fields. */
type PassiveRadiatorFieldName = keyof PassiveRadiatorSpecsSection;

/** One field of a radiator's section; a key absent from the section reads not-available. */
export function prSpec(
    section: SimpleField<PassiveRadiatorSpecsSection>,
    key: PassiveRadiatorFieldName,
): Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable {
    return new DualWriteFieldImpl<number>(
        () => {
            const v = section.value[key]?.value ?? null;
            return v === null ? absentCell<number>('') : enteredCell<number | null>('', v);
        },
        {
            entered: (v: number) => section.set({...section.value, [key]: enteredEntry(v)}),
            clear: () => {
                const {[key]: _removed, ...rest} = section.value;
                section.set(rest);
            },
            // S2-7c/d: entry-backed — a radiator's own T/S spec is never solver-derived, only
            // entered or absent, so `calculated` has nothing real to do yet.
            calculated: () => {},
            dq: () => {},
        },
    );
}
