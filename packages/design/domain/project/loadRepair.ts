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

/** One repair the load made: the field, what the file held, what it holds now (null: the box was
 *  emptied, so the app calculates it or takes its own value), and the line the opening message
 *  shows ("Driver input voltage (each) -6 V in the file: set to the 10 mV minimum"). */
export interface LoadRepairNote {
  readonly field: NumberField;
  readonly loaded: number;
  readonly repaired: number | null;
  readonly text: string;
}

/** What a broken loaded value is set to (null: emptied), and the line saying so. */
export interface LoadRepairFix {
  readonly value: number | null;
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
  /** Writes the repaired value to the record (null: empties the box), without counting as an edit. */
  readonly write: (v: number | null) => void;
}

/** The line the opening message shows for a value repaired to `fixedTo` (a phrase such as "the
 *  10 mV minimum"). The file's number is quoted exactly as it was read. */
export function loadRepairText(field: NumberField, loaded: number, fixedTo: string): string {
  return `${loadedSays(field, loaded)} in the file: set to ${fixedTo}`;
}

/** The line for a value whose box was emptied: "Air density 0 kg/m³ in the file: emptied, so the
 *  box shows the value worked out from the temperature, humidity and pressure". */
export function loadEmptiedText(field: NumberField, loaded: number, shows: string): string {
  return `${loadedSays(field, loaded)} in the file: emptied, so the box shows ${shows}`;
}

/** "Volume 0 L": the field's label and the file's number in the unit the box shows first. */
function loadedSays(field: NumberField, loaded: number): string {
  const unit = field.unitLabel();
  const shown = Number.isFinite(loaded) ? field.toDisplay(loaded) : loaded;
  return unit === '' ? `${field.label} ${shown}` : `${field.label} ${shown} ${unit}`;
}

/** Whether `field`'s own load repair rule says `v` cannot be held: below `limits.min`, outside
 *  `limits`, or not past `floor`. A non-finite number is never held. False for a field that states
 *  no load repair. */
export function fieldRefusesLoaded(field: NumberField, v: number): boolean {
  const repair = field.loadRepair;
  if (repair === null) return false;
  if (!Number.isFinite(v)) return true;
  if (repair.breaks === 'min') return v < field.limits.min;
  if (repair.breaks === 'band') return v < field.limits.min || v > field.limits.max;
  switch (field.floor) {
    case 'positive': return v <= 0;
    case 'non-negative': return v < 0;
    case 'none': return false;
  }
}

/** The rule a field's own `loadRepair` states: a loaded value it refuses is set to `loadRepair.to`,
 *  or its box emptied. */
export function fieldLoadRule(field: NumberField, loaded: () => number | null, write: (v: number | null) => void): LoadRepairRule {
  const repair = field.loadRepair;
  if (repair === null) throw new Error(`${field.value} states no load repair`);
  const to = repair.to;
  return {
    field, loaded, write,
    breaks: v => fieldRefusesLoaded(field, v),
    fix: v => to === 'empty'
      ? {value: null, text: loadEmptiedText(field, v, repair.described)}
      : {value: to, text: loadRepairText(field, v, repair.described)},
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
