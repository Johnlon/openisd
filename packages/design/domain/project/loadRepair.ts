/**
 * The one repair pass a project runs when it is opened (an OpenISD project file, a WinISD `.wpr`, a
 * stored project): every loaded value a field cannot hold is set to the value the field's own
 * definition gives (`NumberField.loadRepair`), and each repair is listed once for the opening
 * message. Typing such a value is refused with a note instead (the box's own bounds).
 *
 * John, 18 Nov 2026: "a repair is ok but it has to be automatic" (QO953.c26); "there won't be a dq
 * flag on a repair as the dq always relate to the value the user can see" (QO953.c30); "all you can
 * do is show a toast" (QO953.c31). So the repaired value is shown as a good value, with no
 * data-quality mark and no note on the box; the opening message names the repair.
 */
import type {NumberField} from '../../fields/field.js';

/** One repair the load made: the field, what the file held, what it holds now, and the line the
 *  opening message shows ("Driver input voltage (each) -6 V in the file: set to the 10 mV minimum"). */
export interface LoadRepairNote {
  readonly field: NumberField;
  readonly loaded: number;
  readonly repaired: number;
  readonly text: string;
}

/** What a broken loaded value is set to, and the line saying so. */
export interface LoadRepairFix {
  readonly value: number;
  readonly text: string;
}

/** One loaded value the pass checks. */
export interface LoadRepairRule {
  readonly field: NumberField;
  /** The value the record holds for this field; null where it holds none (nothing to repair). */
  readonly loaded: () => number | null;
  /** Whether the field cannot hold `v`. */
  readonly breaks: (v: number) => boolean;
  /** What `v` is set to, and the line telling the person. */
  readonly fix: (v: number) => LoadRepairFix;
  /** Writes the repaired value to the record, without counting as an edit. */
  readonly write: (v: number) => void;
}

/** The line the opening message shows for a value repaired to `fixedTo` (a phrase such as "the
 *  10 mV minimum"). The file's number is quoted exactly as it was read. */
export function loadRepairText(field: NumberField, loaded: number, fixedTo: string): string {
  return `${field.label} ${loaded} ${field.unitLabel()} in the file: set to ${fixedTo}`;
}

/** Whether `field`'s own load repair rule says `v` cannot be held: below `limits.min`, or not past
 *  `floor`. A non-finite number is never held. False for a field that states no load repair. */
export function fieldRefusesLoaded(field: NumberField, v: number): boolean {
  const repair = field.loadRepair;
  if (repair === null) return false;
  if (!Number.isFinite(v)) return true;
  if (repair.breaks === 'min') return v < field.limits.min;
  switch (field.floor) {
    case 'positive': return v <= 0;
    case 'non-negative': return v < 0;
    case 'none': return false;
  }
}

/** The rule a field's own `loadRepair` states: a loaded value it refuses is set to `loadRepair.to`. */
export function fieldLoadRule(field: NumberField, loaded: () => number | null, write: (v: number) => void): LoadRepairRule {
  const repair = field.loadRepair;
  if (repair === null) throw new Error(`${field.value} states no load repair`);
  return {
    field, loaded, write,
    breaks: v => fieldRefusesLoaded(field, v),
    fix: v => ({value: repair.to, text: loadRepairText(field, v, repair.described)}),
  };
}

/** Runs every rule in order over the record it reads and writes; returns the repairs made. A rule
 *  reads the record as the rules before it left it. */
export function repairLoaded(rules: readonly LoadRepairRule[]): readonly LoadRepairNote[] {
  const notes: LoadRepairNote[] = [];
  for (const rule of rules) {
    const v = rule.loaded();
    if (v === null || !rule.breaks(v)) continue;
    const fix = rule.fix(v);
    rule.write(fix.value);
    notes.push({field: rule.field, loaded: v, repaired: fix.value, text: fix.text});
  }
  return notes;
}
