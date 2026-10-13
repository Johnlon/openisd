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

export type CloudResult<T> =
  | { readonly kind: 'ok'; readonly value: T }
  | { readonly kind: 'moved'; readonly head: CloudMeta }
  | { readonly kind: 'offline' }
  | { readonly kind: 'unauthorised' }
  | { readonly kind: 'quota'; readonly retryAfter_ms: number }
  | { readonly kind: 'cursorExpired' }
  | { readonly kind: 'malformed'; readonly reason: string }
  | { readonly kind: 'failed'; readonly status: number; readonly reason: string };

export type CloudChange = CloudMeta | { readonly fileId: FileId; readonly gone: true };

export type CloudChanges =
  | { readonly kind: 'more'; readonly changed: readonly CloudChange[]; readonly next: ChangeCursor }
  | { readonly kind: 'done'; readonly changed: readonly CloudChange[]; readonly newStart: ChangeCursor };

export interface CloudFileList {
  readonly docs: readonly CloudMeta[];
  readonly next: ChangeCursor | null;
}

export interface CloudStore {
  listAll(): Promise<CloudResult<CloudFileList>>;
  changesSince(cursor: ChangeCursor): Promise<CloudResult<CloudChanges>>;
  read(fileId: FileId): Promise<CloudResult<CloudDoc>>;
  create(id: DocId, body: string, meta: WriteMeta): Promise<CloudResult<CloudMeta>>;
  update(fileId: FileId, expectedRevision: RevisionId, body: string, meta: WriteMeta): Promise<CloudResult<CloudMeta>>;
  tombstone(fileId: FileId, expectedRevision: RevisionId, meta: WriteMeta): Promise<CloudResult<CloudMeta>>;
  purge(fileId: FileId): Promise<CloudResult<void>>;
}

export interface Http {
  fetch(url: string, init: { method: string; headers: Record<string, string>; body?: string }): Promise<{
    readonly status: number;
    readonly headers: { get(name: string): string | null };
    text(): Promise<string>;
  }>;
}

export interface CloudSession {
  grant(): { readonly kind: 'none' } | { readonly kind: 'connected'; readonly account: string } | { readonly kind: 'reconnect'; readonly account: string };
  accessToken(): Promise<{ readonly kind: 'ok'; readonly token: string } | { readonly kind: 'none' } | { readonly kind: 'reconnect' } | { readonly kind: 'offline' }>;
  onBoot(location: { readonly search: string; readonly hash: string }): Promise<
    | { readonly kind: 'notACallback' }
    | { readonly kind: 'connected'; readonly account: string; readonly returnTo: string }
    | { readonly kind: 'denied'; readonly returnTo: string }
    | { readonly kind: 'failed'; readonly reason: string; readonly returnTo: string }
    | { readonly kind: 'willRedirect'; readonly go: () => void }
  >;
  beginConnect(reason: 'connect' | 'reconnect'): void;
  disconnect(): Promise<void>;
}