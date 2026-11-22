import type {
  ChangeCursor, CloudChanges, CloudGrant, CloudDoc, CloudFileList, CloudMeta, CloudResult, DocId, FileId, RevisionId, WriteMeta,
} from '@openisd/design/cloud';

export interface CloudStore {
  listAll(): Promise<CloudResult<CloudFileList>>;
  changesSince(cursor: ChangeCursor): Promise<CloudResult<CloudChanges>>;
  startCursor(): Promise<CloudResult<ChangeCursor>>;
  read(fileId: FileId): Promise<CloudResult<CloudDoc>>;
  create(id: DocId, body: string, meta: WriteMeta): Promise<CloudResult<CloudMeta>>;
  update(fileId: FileId, expectedRevision: RevisionId, body: string, meta: WriteMeta): Promise<CloudResult<CloudMeta>>;
  tombstone(fileId: FileId, expectedRevision: RevisionId, meta: WriteMeta): Promise<CloudResult<CloudMeta>>;
  purge(fileId: FileId): Promise<CloudResult<void>>;
  /** Deletes a file outright, with no tombstone: for a duplicate copy of a doc whose newest copy
   *  stays, so no device ever reads the doc as deleted. */
  removeFile(fileId: FileId): Promise<CloudResult<void>>;
}

export type { Http, HttpRequest, HttpResponse } from './http.js';

export interface CloudSession {
  grant(): CloudGrant;
  /** Stores the signed-in email as the held token's account name. */
  nameAccount(email: string): void;
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