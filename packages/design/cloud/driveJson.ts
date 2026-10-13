import type { DocId } from './syncDoc.js';
import type { CloudMeta, CloudResult, CloudChange, CloudChanges, CloudFileList } from './cloudTypes.js';
import { FileId, RevisionId, ChangeCursor, BodyHash, field } from './syncDoc.js';

interface DriveFile {
  readonly id: string;
  readonly name?: string;
  readonly headRevisionId?: string;
  readonly appProperties?: Record<string, string>;
}

interface DriveFileList {
  readonly kind: 'drive#fileList';
  readonly nextPageToken?: string;
  readonly files: readonly DriveFile[];
}

interface DriveChange {
  readonly fileId: string;
  readonly removed?: boolean;
  readonly deleted?: boolean;
  readonly file?: DriveFile;
}

interface DriveChangeList {
  readonly kind: 'drive#changeList';
  readonly nextPageToken?: string;
  readonly newStartPageToken?: string;
  readonly changes: readonly DriveChange[];
}

interface DriveErrorItem {
  readonly reason?: string;
  readonly message?: string;
}

interface DriveError {
  readonly error: {
    readonly code?: number;
    readonly message?: string;
    readonly errors?: readonly DriveErrorItem[];
  };
}

function parseDriveFile(obj: unknown): DriveFile | null {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return null;
  const idVal = field(obj, 'id');
  if (typeof idVal !== 'string' || idVal === '') return null;
  const nameVal = field(obj, 'name');
  if (nameVal !== undefined && typeof nameVal !== 'string') return null;
  const headRevVal = field(obj, 'headRevisionId');
  if (headRevVal !== undefined && typeof headRevVal !== 'string') return null;
  const appPropsVal = field(obj, 'appProperties');
  let appProperties: Record<string, string> | undefined;
  if (appPropsVal !== undefined) {
    if (typeof appPropsVal !== 'object' || appPropsVal === null || Array.isArray(appPropsVal)) {
      return null;
    }
    const entries: Record<string, string> = {};
    for (const key of Object.keys(appPropsVal)) {
      const val = field(appPropsVal, key);
      if (typeof val !== 'string' && val !== null) {
        return null;
      }
      if (typeof val === 'string') {
        entries[key] = val;
      }
    }
    appProperties = entries;
  }
  return {
    id: idVal,
    ...(typeof nameVal === 'string' ? { name: nameVal } : {}),
    ...(typeof headRevVal === 'string' ? { headRevisionId: headRevVal } : {}),
    ...(appProperties !== undefined ? { appProperties } : {})
  };
}

function parseDriveFileList(obj: unknown): DriveFileList | null {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return null;
  if (field(obj, 'kind') !== 'drive#fileList') return null;
  const nextTokenVal = field(obj, 'nextPageToken');
  if (nextTokenVal !== undefined && typeof nextTokenVal !== 'string') return null;
  const filesVal = field(obj, 'files');
  if (filesVal !== undefined && !Array.isArray(filesVal)) return null;
  const files: DriveFile[] = [];
  if (Array.isArray(filesVal)) {
    for (const item of filesVal) {
      const file = parseDriveFile(item);
      if (!file) return null;
      files.push(file);
    }
  }
  return {
    kind: 'drive#fileList',
    ...(typeof nextTokenVal === 'string' ? { nextPageToken: nextTokenVal } : {}),
    files
  };
}

function parseDriveChange(obj: unknown): DriveChange | null {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return null;
  const fileIdVal = field(obj, 'fileId');
  if (typeof fileIdVal !== 'string' || fileIdVal === '') return null;
  const removedVal = field(obj, 'removed');
  if (removedVal !== undefined && typeof removedVal !== 'boolean') return null;
  const deletedVal = field(obj, 'deleted');
  if (deletedVal !== undefined && typeof deletedVal !== 'boolean') return null;
  const fileVal = field(obj, 'file');
  let file: DriveFile | undefined;
  if (fileVal !== undefined) {
    const parsedFile = parseDriveFile(fileVal);
    if (!parsedFile) return null;
    file = parsedFile;
  }
  return {
    fileId: fileIdVal,
    ...(typeof removedVal === 'boolean' ? { removed: removedVal } : {}),
    ...(typeof deletedVal === 'boolean' ? { deleted: deletedVal } : {}),
    ...(file !== undefined ? { file } : {})
  };
}

function parseDriveChangeList(obj: unknown): DriveChangeList | null {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return null;
  if (field(obj, 'kind') !== 'drive#changeList') return null;
  const nextTokenVal = field(obj, 'nextPageToken');
  if (nextTokenVal !== undefined && typeof nextTokenVal !== 'string') return null;
  const newStartTokenVal = field(obj, 'newStartPageToken');
  if (newStartTokenVal !== undefined && typeof newStartTokenVal !== 'string') return null;
  const changesVal = field(obj, 'changes');
  if (changesVal !== undefined && !Array.isArray(changesVal)) return null;
  const changes: DriveChange[] = [];
  if (Array.isArray(changesVal)) {
    for (const item of changesVal) {
      const change = parseDriveChange(item);
      if (!change) return null;
      changes.push(change);
    }
  }
  return {
    kind: 'drive#changeList',
    ...(typeof nextTokenVal === 'string' ? { nextPageToken: nextTokenVal } : {}),
    ...(typeof newStartTokenVal === 'string' ? { newStartPageToken: newStartTokenVal } : {}),
    changes
  };
}

function parseDriveErrorItem(obj: unknown): DriveErrorItem | null {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return null;
  const reasonVal = field(obj, 'reason');
  if (reasonVal !== undefined && typeof reasonVal !== 'string') return null;
  const msgVal = field(obj, 'message');
  if (msgVal !== undefined && typeof msgVal !== 'string') return null;
  return {
    ...(typeof reasonVal === 'string' ? { reason: reasonVal } : {}),
    ...(typeof msgVal === 'string' ? { message: msgVal } : {})
  };
}

function parseDriveError(obj: unknown): DriveError | null {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return null;
  const errVal = field(obj, 'error');
  if (typeof errVal !== 'object' || errVal === null || Array.isArray(errVal)) return null;
  const codeVal = field(errVal, 'code');
  if (codeVal !== undefined && typeof codeVal !== 'number') return null;
  const messageVal = field(errVal, 'message');
  if (messageVal !== undefined && typeof messageVal !== 'string') return null;
  const errorsVal = field(errVal, 'errors');
  if (errorsVal !== undefined && !Array.isArray(errorsVal)) return null;
  let errors: DriveErrorItem[] | undefined;
  if (Array.isArray(errorsVal)) {
    errors = [];
    for (const item of errorsVal) {
      const errItem = parseDriveErrorItem(item);
      if (!errItem) return null;
      errors.push(errItem);
    }
  }
  return {
    error: {
      ...(typeof codeVal === 'number' ? { code: codeVal } : {}),
      ...(typeof messageVal === 'string' ? { message: messageVal } : {}),
      ...(errors !== undefined ? { errors } : {})
    }
  };
}

function parseAppProperties(props: Record<string, string> | undefined): { readonly kind: 'ok'; readonly data: AppProps } | { readonly kind: 'malformed'; readonly reason: string } {
  if (!props) {
    return { kind: 'malformed', reason: 'Missing appProperties' };
  }
  if (props.app !== 'openisd') {
    return { kind: 'malformed', reason: 'Not an openisd file' };
  }
  const kind = props.kind;
  if (kind !== 'project' && kind !== 'driver' && kind !== 'pr' && kind !== 'settings' && kind !== 'favourites') {
    return { kind: 'malformed', reason: `Unknown kind: ${kind}` };
  }
  const uuid = props.uuid;
  if (!uuid && kind !== 'settings' && kind !== 'favourites') {
    return { kind: 'malformed', reason: 'Missing uuid' };
  }
  const layout = parseInt(props.layout, 10);
  if (!Number.isInteger(layout) || layout < 1) {
    return { kind: 'malformed', reason: 'Invalid layout' };
  }
  const seq = parseInt(props.seq, 10);
  if (!Number.isInteger(seq) || seq < 0) {
    return { kind: 'malformed', reason: 'Invalid seq' };
  }
  const writer = props.writer;
  if (!writer) {
    return { kind: 'malformed', reason: 'Missing writer' };
  }
  const parentRevision = props.parentRevision ?? null;
  const hash = props.hash ?? null;
  const deleted = props.deleted === '1';
  return {
    kind: 'ok',
    data: { kind, uuid: uuid ?? '', layout, seq, writer, parentRevision, hash, deleted }
  };
}

interface AppProps {
  readonly kind: 'project' | 'driver' | 'pr' | 'settings' | 'favourites';
  readonly uuid: string;
  readonly layout: number;
  readonly seq: number;
  readonly writer: string;
  readonly parentRevision: string | null;
  readonly hash: string | null;
  readonly deleted: boolean;
}

function buildDocId(kind: AppProps['kind'], uuid: string): DocId {
  switch (kind) {
    case 'project':
      return { kind: 'project', uuid };
    case 'driver':
      return { kind: 'driver', uuid };
    case 'pr':
      return { kind: 'pr', uuid };
    case 'settings':
      return { kind: 'settings' };
    case 'favourites':
      return { kind: 'favourites' };
  }
}

export function parseFileList(jsonText: string): CloudResult<CloudFileList> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { kind: 'malformed', reason: 'Invalid JSON' };
  }
  const fileList = parseDriveFileList(parsed);
  if (!fileList) {
    return { kind: 'malformed', reason: 'Not a file list' };
  }
  const docs: CloudMeta[] = [];
  for (const file of fileList.files) {
    const propsResult = parseAppProperties(file.appProperties);
    if (propsResult.kind === 'malformed') {
      if (propsResult.reason === 'Not an openisd file') {
        continue;
      }
      return { kind: 'malformed', reason: `File ${file.id}: ${propsResult.reason}` };
    }
    const { data: props } = propsResult;
    if (!file.headRevisionId) {
      return { kind: 'malformed', reason: `File ${file.id}: Missing headRevisionId` };
    }
    const fid = FileId.of(file.id);
    const rev = RevisionId.of(file.headRevisionId);
    if (!fid || !rev) {
      return { kind: 'malformed', reason: `File ${file.id}: Invalid file ID or headRevisionId` };
    }
    const docId = buildDocId(props.kind, props.uuid);
    docs.push({
      id: docId,
      fileId: fid,
      revision: rev,
      parentRevision: props.parentRevision ? RevisionId.of(props.parentRevision) : null,
      layout: props.layout,
      seq: props.seq,
      writer: props.writer,
      deleted: props.deleted,
      remoteHash: props.hash ? BodyHash.of(props.hash) : null
    });
  }
  let next: ChangeCursor | null = null;
  if (fileList.nextPageToken !== undefined) {
    next = ChangeCursor.of(fileList.nextPageToken);
    if (!next) {
      return { kind: 'malformed', reason: 'Invalid nextPageToken' };
    }
  }
  return { kind: 'ok', value: { docs, next } };
}

export function parseChangeList(jsonText: string): CloudResult<CloudChanges> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { kind: 'malformed', reason: 'Invalid JSON' };
  }
  const changeList = parseDriveChangeList(parsed);
  if (!changeList) {
    return { kind: 'malformed', reason: 'Not a change list' };
  }

  const nextToken = changeList.nextPageToken;
  const newStartToken = changeList.newStartPageToken;

  if ((nextToken === undefined || nextToken === '') && (newStartToken === undefined || newStartToken === '')) {
    return { kind: 'malformed', reason: 'Changes page has neither nextPageToken nor newStartPageToken' };
  }

  const changed: CloudChange[] = [];
  for (const change of changeList.changes) {
    if (change.removed === true) {
      const fid = FileId.of(change.fileId);
      if (!fid) {
        return { kind: 'malformed', reason: `Change ${change.fileId}: Invalid fileId` };
      }
      changed.push({ fileId: fid, gone: true });
      continue;
    }

    const file = change.file;
    if (!file) {
      continue;
    }

    const propsResult = parseAppProperties(file.appProperties);
    if (propsResult.kind === 'malformed') {
      if (propsResult.reason === 'Not an openisd file') {
        continue;
      }
      return { kind: 'malformed', reason: `Change ${change.fileId}: ${propsResult.reason}` };
    }
    const { data: props } = propsResult;
    if (!file.headRevisionId) {
      return { kind: 'malformed', reason: `Change ${change.fileId}: Missing headRevisionId` };
    }
    const fid = FileId.of(file.id);
    const rev = RevisionId.of(file.headRevisionId);
    if (!fid || !rev) {
      return { kind: 'malformed', reason: `Change ${change.fileId}: Invalid file ID or headRevisionId` };
    }
    const docId = buildDocId(props.kind, props.uuid);
    changed.push({
      id: docId,
      fileId: fid,
      revision: rev,
      parentRevision: props.parentRevision ? RevisionId.of(props.parentRevision) : null,
      layout: props.layout,
      seq: props.seq,
      writer: props.writer,
      deleted: props.deleted,
      remoteHash: props.hash ? BodyHash.of(props.hash) : null
    });
  }

  if (nextToken !== undefined && nextToken !== '') {
    const nextCursor = ChangeCursor.of(nextToken);
    if (!nextCursor) {
      return { kind: 'malformed', reason: 'Invalid nextPageToken' };
    }
    return { kind: 'ok', value: { kind: 'more', changed, next: nextCursor } };
  }

  if (newStartToken !== undefined && newStartToken !== '') {
    const newStartCursor = ChangeCursor.of(newStartToken);
    if (!newStartCursor) {
      return { kind: 'malformed', reason: 'Invalid newStartPageToken' };
    }
    return { kind: 'ok', value: { kind: 'done', changed, newStart: newStartCursor } };
  }

  return { kind: 'malformed', reason: 'Changes page has neither nextPageToken nor newStartPageToken' };
}

export function parseFileMetadata(jsonText: string): CloudResult<CloudMeta> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { kind: 'malformed', reason: 'Invalid JSON' };
  }
  const file = parseDriveFile(parsed);
  if (!file) {
    return { kind: 'malformed', reason: 'Not a file metadata' };
  }
  const propsResult = parseAppProperties(file.appProperties);
  if (propsResult.kind === 'malformed') {
    return { kind: 'malformed', reason: propsResult.reason };
  }
  const { data: props } = propsResult;
  if (!file.headRevisionId) {
    return { kind: 'malformed', reason: 'Missing headRevisionId' };
  }
  const fid = FileId.of(file.id);
  const rev = RevisionId.of(file.headRevisionId);
  if (!fid || !rev) {
    return { kind: 'malformed', reason: 'Invalid file ID or headRevisionId' };
  }
  const docId = buildDocId(props.kind, props.uuid);
  return {
    kind: 'ok',
    value: {
      id: docId,
      fileId: fid,
      revision: rev,
      parentRevision: props.parentRevision ? RevisionId.of(props.parentRevision) : null,
      layout: props.layout,
      seq: props.seq,
      writer: props.writer,
      deleted: props.deleted,
      remoteHash: props.hash ? BodyHash.of(props.hash) : null
    }
  };
}

export function parseWriteReply(jsonText: string): CloudResult<CloudMeta> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { kind: 'malformed', reason: 'Invalid JSON' };
  }
  const file = parseDriveFile(parsed);
  if (!file) {
    return { kind: 'malformed', reason: 'Not a file write reply' };
  }
  const propsResult = parseAppProperties(file.appProperties);
  if (propsResult.kind === 'malformed') {
    return { kind: 'malformed', reason: propsResult.reason };
  }
  const { data: props } = propsResult;
  if (!file.headRevisionId) {
    return { kind: 'malformed', reason: 'Missing headRevisionId' };
  }
  const fid = FileId.of(file.id);
  const rev = RevisionId.of(file.headRevisionId);
  if (!fid || !rev) {
    return { kind: 'malformed', reason: 'Invalid file ID or headRevisionId' };
  }
  const docId = buildDocId(props.kind, props.uuid);
  return {
    kind: 'ok',
    value: {
      id: docId,
      fileId: fid,
      revision: rev,
      parentRevision: props.parentRevision ? RevisionId.of(props.parentRevision) : null,
      layout: props.layout,
      seq: props.seq,
      writer: props.writer,
      deleted: props.deleted,
      remoteHash: props.hash ? BodyHash.of(props.hash) : null
    }
  };
}

export function parseErrorResponse(status: number, jsonText: string): CloudResult<never> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { kind: 'failed', status, reason: 'Invalid JSON error response' };
  }
  const driveError = parseDriveError(parsed);
  if (!driveError) {
    return { kind: 'failed', status, reason: 'Not a Drive error response' };
  }
  const { errors, message } = driveError.error;
  const reason = errors?.[0]?.reason ?? message ?? `HTTP ${status}`;
  if (status === 401) {
    return { kind: 'unauthorised' };
  }
  if (status === 403 || status === 429) {
    const retryAfter = errors?.[0]?.reason === 'userRateLimitExceeded' ? 60000 : 30000;
    return { kind: 'quota', retryAfter_ms: retryAfter };
  }
  if (status === 410) {
    return { kind: 'cursorExpired' };
  }
  return { kind: 'failed', status, reason };
}