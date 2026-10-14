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

/** The Drive request a fault came from; 'request' when the store does not say. */
export type CloudOperation = 'list' | 'changes' | 'startCursor' | 'read' | 'create' | 'update' | 'tombstone' | 'purge' | 'removeDuplicate' | 'about' | 'request';

/** What went wrong with one Drive request: the request, the HTTP status, Drive's error or the
 *  reason its reply did not read, and the start of the reply as Drive sent it. */
export interface CloudFault {
  readonly operation: CloudOperation;
  readonly status: number;
  readonly reason: string;
  /** The first 300 characters of the reply body. */
  readonly reply: string;
}

/** The longest reply start a fault keeps. */
export const FAULT_REPLY_CHARS = 300;

export function cloudFaultOf(operation: CloudOperation, status: number, reason: string, body: string): CloudFault {
  return {operation, status, reason, reply: body.slice(0, FAULT_REPLY_CHARS)};
}

/** Whether this browser holds a Google grant, and for which account. */
export type CloudGrant =
  | { readonly kind: 'none' }
  | { readonly kind: 'connected'; readonly account: string }
  | { readonly kind: 'reconnect'; readonly account: string };

/** The last sync fault and when it happened; kept until the next successful sync. */
export interface CloudFaultRecord {
  readonly fault: CloudFault;
  readonly at_ms: number;
}

/** The status line for a fault: what Drive said, or what to do when Google refused access. */
export function cloudFaultText(fault: CloudFault): string {
  if (fault.status === 403) return 'Google did not grant Drive access. Disconnect and connect again.';
  if (fault.status === 0) return `Sync failed: ${fault.operation} got no reply from Drive (${fault.reason}).`;
  const said = fault.reply === '' ? '' : ` Drive said: ${fault.reply}`;
  return `Sync failed: ${fault.operation}, HTTP ${fault.status}, ${fault.reason}.${said}`;
}

export type CloudError =
  | { readonly kind: 'faulted'; readonly fault: CloudFault }
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
