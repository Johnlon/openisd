export type Provenance = 'entered' | 'calculated' | 'not-available';

/** A field's value AND its provenance together, in one call — never split into a separate
 *  value getter and a separate provenance getter (they could drift out of sync in a caller). */
export interface Cell<T> {
  readonly value: T | null;
  readonly state: Provenance;
}

/** A stored field that IS part of a solve relation, so it carries provenance.
 *
 *  Same VERBS as `RawField` — `get`/`set` mean the same thing on both, so a client never has to
 *  learn a second vocabulary for reading and writing depending on which kind of field it holds.
 *  What differs is what `get()` can tell you (value AND provenance, not just the value) and the
 *  extra `clear()`, which is a real additional capability rather than a rename of an existing
 *  one: only a solved field has an Entered mark to remove. */
export interface FieldHandle<T> {
  get(): Cell<T>;
  set(v: T): void;
  clear(): void;
}

/** A stored field with NO solve relation and no provenance to track — a loss factor, a box
 *  type, a count. Still a HANDLE, not a bare `X()`/`setX()` method pair on its parent: every
 *  stored field in this domain is reached the same way, with the same verbs, so a caller never
 *  has to remember which kind a given field is. `FieldHandle` and `RawField` differ in what they
 *  can DO — one is part of a solve relation and carries provenance, the other is not and does
 *  not — never in shape or vocabulary.
 *
 *  A derived, read-only CALCULATION (`resonance_hz()`, `area_m2()`) is deliberately NOT a
 *  handle: it is not a stored field, has nothing to set, and stays a plain method. */
export interface RawField<T> {
  get(): T;
  set(v: T): void;
}

/** The one concrete `FieldHandle` implementation — consistent get/enter/clear logic in ONE
 *  place, driven by three small callbacks the owning class supplies, instead of every field
 *  hand-writing its own copy of the same three-method shape. */
export class Field<T> implements FieldHandle<T> {
  constructor(
    private readonly readCell: () => Cell<T>,
    private readonly writeValue: (v: T) => void,
    private readonly clearValue: () => void,
  ) {}

  get(): Cell<T> { return this.readCell(); }
  set(v: T): void { this.writeValue(v); }
  clear(): void { this.clearValue(); }
}

// ---------------------------------------------------------------------------------------------
// LENSES, and the field constructors built on them. Generic plumbing: nothing here knows any
// domain type, which is why it lives beside `Field` rather than in the domain file that happens
// to use it.
// ---------------------------------------------------------------------------------------------

/** A get/set pair onto one slice of somebody else's storage. Composable: `focus()` derives a
 *  lens on a property from a lens on its parent, so a chamber's losses lens is the box lens
 *  narrowed twice — every write still lands as one copy-on-write update of the whole box
 *  record, because each level rebuilds its parent through the level above it. */
export interface Lens<T> {
  get(): T;
  set(v: T): void;
}

export function focus<P, K extends keyof P>(parent: Lens<P>, key: K): Lens<P[K]> {
  return {
    get: () => parent.get()[key],
    set: (v) => parent.set({ ...parent.get(), [key]: v }),
  };
}

/** A `FieldHandle` over a nullable numeric slot — absent reads as `not-available`, and `clear()`
 *  returns it to absent rather than to a fabricated zero. */
export function nullableField<T extends object>(lens: Lens<T>, key: NullableNumberKey<T>): Field<number> {
  return new Field<number>(
    () => {
      const v = lens.get()[key] as number | null;
      return { value: v, state: v === null ? 'not-available' : 'entered' };
    },
    (v) => lens.set({ ...lens.get(), [key]: v }),
    () => lens.set({ ...lens.get(), [key]: null }),
  );
}

type NullableNumberKey<T> = {
  [K in keyof T]: T[K] extends number | null ? K : never;
}[keyof T];

/** A `FieldHandle` over a non-nullable numeric slot — always present, so always `entered`, and
 *  `clear()` is a real error rather than a silent no-op: there is no absent state to return to. */
export function requiredField<T extends object>(
  lens: Lens<T>,
  key: keyof T,
  label: string,
): Field<number> {
  return new Field<number>(
    () => ({ value: lens.get()[key] as number, state: 'entered' }),
    (v) => lens.set({ ...lens.get(), [key]: v }),
    () => {
      throw new Error(
        `${label} cannot be cleared: it always has a value in this design — there is no ` +
        '"not entered" state for it to return to.',
      );
    },
  );
}
