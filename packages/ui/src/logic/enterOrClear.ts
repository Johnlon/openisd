import type {Clearable, Writable} from '@openisd/design';

/** Write a number typed into a box onto its field; an emptied box (`null`) clears the field
 *  rather than storing 0, so a cleared figure reads absent, never a value nobody typed. */
export function enterOrClear(field: Writable<number> & Clearable, v: number | null): void {
  if (v === null) field.clear(); else field.set(v);
}
