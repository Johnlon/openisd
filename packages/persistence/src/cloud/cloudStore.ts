import type {
  ChangeCursor, CloudChanges, CloudDoc, CloudFileList, CloudMeta, CloudResult, DocId, FileId, RevisionId, WriteMeta,
} from '@openisd/design/cloud';

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