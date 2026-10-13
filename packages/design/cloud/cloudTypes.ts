/** The values the cloud store port and the Drive reply parsers exchange. */
import type { DocId, FileId, RevisionId, ChangeCursor, BodyHash } from './syncDoc.js';

export interface CloudMeta {
  readonly id: DocId;
  readonly fileId: FileId;
  readonly revision: RevisionId;
  readonly parentRevision: RevisionId | null;
  readonly layout: number;
  readonly seq: number;
  readonly writer: string;
  readonly deleted: boolean;
  readonly remoteHash: BodyHash | null;
}

export interface CloudDoc {
  readonly meta: CloudMeta;
  readonly body: string;
}

export interface WriteMeta {
  readonly parentRevision: RevisionId | null;
  readonly layout: number;
  readonly seq: number;
  readonly writer: string;
  readonly hash: BodyHash;
}

export type CloudError =
  | { readonly kind: 'moved'; readonly head: CloudMeta }
  | { readonly kind: 'offline' }
  | { readonly kind: 'unauthorised' }
  | { readonly kind: 'quota'; readonly retryAfter_ms: number }
  | { readonly kind: 'cursorExpired' }
  | { readonly kind: 'malformed'; readonly reason: string }
  | { readonly kind: 'failed'; readonly status: number; readonly reason: string };

export type CloudResult<T> =
  | { readonly kind: 'ok'; readonly value: T }
  | CloudError;

export type CloudChange = CloudMeta | { readonly fileId: FileId; readonly gone: true };

export type CloudChanges =
  | { readonly kind: 'more'; readonly changed: readonly CloudChange[]; readonly next: ChangeCursor }
  | { readonly kind: 'done'; readonly changed: readonly CloudChange[]; readonly newStart: ChangeCursor };

export interface CloudFileList {
  readonly docs: readonly CloudMeta[];
  readonly next: ChangeCursor | null;
}
