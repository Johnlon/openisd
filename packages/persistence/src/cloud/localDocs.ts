import type { DeviceName, DocId, DocKind } from '@openisd/design/cloud';

export interface LocalDoc {
  readonly id: DocId;
  readonly body: string;
  readonly layout: number;
}

export type LocalRead =
  | { readonly kind: 'ok'; readonly docs: readonly LocalDoc[] }
  | { readonly kind: 'unreadable' };

export interface LocalDocs {
  readonly kind: DocKind;
  list(): LocalRead;
  /** Body in this app's layout. A doc from an older layout is migrated by `migrate` first.
   *  `from`: the name of the device that wrote it ('' when it did not say). */
  put(doc: LocalDoc, from: string): 'done' | 'refused';
  remove(id: DocId): 'done' | 'refused';
  /** Returns the body in this app's layout, or null when no step reaches it. */
  migrate(doc: LocalDoc): string | null;
  /** The name a person knows the item by: a project's or driver's name, '' when it has none
   *  (Options, Favourites and Bin marks are named by what they are, or by their project). */
  nameOf(doc: LocalDoc): string;
  /** The keep-both copy: a new uuid, a visible name mark. Never called when hashes are equal. */
  putConflictCopy(doc: LocalDoc, from: DeviceName, at_ms: number): KeptCopy | 'refused';
}

/** A keep-both copy as stored: its id and body, the item's own name and the copy's marked name. */
export interface KeptCopy {
  readonly id: DocId;
  readonly body: string;
  readonly item: string;
  readonly name: string;
}
