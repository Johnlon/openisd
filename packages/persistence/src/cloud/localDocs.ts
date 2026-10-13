import type { DeviceId, DocId, DocKind } from '@openisd/design/cloud';

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
  /** Body in this app's layout. A doc from an older layout is migrated by `migrate` first. */
  put(doc: LocalDoc): 'done' | 'refused';
  remove(id: DocId): 'done' | 'refused';
  /** Returns the body in this app's layout, or null when no step reaches it. */
  migrate(doc: LocalDoc): string | null;
  /** The keep-both copy: a new uuid, a visible name mark. Never called when hashes are equal. */
  putConflictCopy(doc: LocalDoc, from: DeviceId, at_ms: number): { readonly id: DocId } | 'refused';
}
