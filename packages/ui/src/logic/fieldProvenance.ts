import type {Calculated, Entered, Readable} from '@openisd/design';

/** The badge letter a field shows: `E` entered, `C` calculated, `N` no value. */
export type ProvenanceLetter = 'E' | 'C' | 'N';

/** `E` when a person entered the value, `C` when it was derived, else `N`. The one place the
 *  two provenance flags become a letter — a field without `Calculated` can never show `C`. */
export function provenanceOf(field: Readable<unknown> & Entered & Calculated): ProvenanceLetter {
  if (field.entered) return 'E';
  if (field.calculated) return 'C';
  return 'N';
}

/** For a field with no `Calculated`: `E` when entered, else `N`. */
export function provenanceOfEntry(field: Entered): ProvenanceLetter {
  return field.entered ? 'E' : 'N';
}

/** For a field with no `Entered` — only a solver writes it: `C` when solved, else `N`. */
export function provenanceOfSolved(field: Calculated): ProvenanceLetter {
  return field.calculated ? 'C' : 'N';
}
