import type {CloudSession, CloudStore} from '../cloudStore.js';
import type {CloudIdentity} from '../accountNamer.js';
import type {
  CloudChange, CloudChanges, CloudDoc, CloudError, CloudFileList, CloudMeta, CloudOperation, CloudResult, WriteMeta,
} from '@openisd/design/cloud';
import type { Http, HttpMethod } from '../http.js';
import {
  ChangeCursor, cloudFaultOf, type DocId, docFileName, FileId, parseAboutUser, parseChangeList, parseErrorResponse, parseFileList, parseFileMetadata,
  parseStartPageToken, parseWriteReply, RevisionId,
} from '@openisd/design/cloud';

export interface DriveStoreDeps {
  readonly http: Http;
  readonly session: CloudSession;
  readonly baseUrl?: string;
  readonly uploadUrl?: string;
}

const DEFAULT_BASE_URL = 'https://www.googleapis.com';
const DEFAULT_UPLOAD_URL = 'https://www.googleapis.com/upload';
const MULTIPART_BOUNDARY = '-------OpenISDCloudSyncBoundary';

function getHeader(headers: Record<string, string> | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  const target = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === target) {
      return v;
    }
  }
  return undefined;
}

function parseRetryAfterMs(headers: Record<string, string> | undefined): number {
  const header = getHeader(headers, 'retry-after');
  if (header === undefined) {
    return 1000;
  }
  const val = parseFloat(header);
  if (!Number.isNaN(val) && val > 0) {
    return Math.round(val * 1000);
  }
  return 1000;
}

async function getAuthHeader(session: CloudSession): Promise<
  | { readonly kind: 'ok'; readonly header: string }
  | { readonly kind: 'offline' }
  | { readonly kind: 'unauthorised' }
> {
  const tokenResult = await session.accessToken();
  switch (tokenResult.kind) {
    case 'ok':
      return { kind: 'ok', header: `Bearer ${tokenResult.token}` };
    case 'offline':
      return { kind: 'offline' };
    case 'none':
    case 'reconnect':
      return { kind: 'unauthorised' };
  }
}

type HttpDispatchResult =
  | { readonly kind: 'ok'; readonly status: number; readonly text: string; readonly headers?: Record<string, string> }
  | CloudError;

async function dispatch(
  http: Http,
  session: CloudSession,
  operation: CloudOperation,
  req: {
    readonly method: HttpMethod;
    readonly url: string;
    readonly headers?: Record<string, string>;
    readonly body?: string;
  }
): Promise<HttpDispatchResult> {
  const auth = await getAuthHeader(session);
  if (auth.kind !== 'ok') {
    return auth;
  }
  const headers: Record<string, string> = {
    ...req.headers,
    Authorization: auth.header
  };
  const res = await http.send({
    method: req.method,
    url: req.url,
    headers,
    body: req.body
  });
  if ('kind' in res) {
    return { kind: 'offline' };
  }
  if (res.status >= 400 || res.status < 200) {
    const retryAfter = parseRetryAfterMs(res.headers);
    const err = parseErrorResponse(res.status, res.text, retryAfter);
    return err.kind === 'failed' ? { kind: 'faulted', fault: cloudFaultOf(operation, res.status, err.reason, res.text) } : err;
  }
  return {
    kind: 'ok',
    status: res.status,
    text: res.text,
    headers: res.headers
  };
}

/** A parsed reply, or the parser's refusal as a fault that keeps the reply it refused. */
function readReply<T>(operation: CloudOperation, res: { readonly status: number; readonly text: string }, parsed: CloudResult<T>): CloudResult<T> {
  if (parsed.kind !== 'malformed') return parsed;
  return { kind: 'faulted', fault: cloudFaultOf(operation, res.status, parsed.reason, res.text) };
}

export function createDriveStore(deps: DriveStoreDeps): CloudStore & CloudIdentity {
  const http = deps.http;
  const session = deps.session;
  const baseUrl = deps.baseUrl ?? DEFAULT_BASE_URL;
  const uploadUrl = deps.uploadUrl ?? DEFAULT_UPLOAD_URL;

  async function signedInEmail(): Promise<CloudResult<string>> {
    const url = `${baseUrl}/drive/v3/about?fields=user(emailAddress)`;
    const res = await dispatch(http, session, 'about', { method: 'GET', url });
    if (res.kind !== 'ok') {
      return res;
    }
    return readReply('about', res, parseAboutUser(res.text));
  }

  async function listAll(): Promise<CloudResult<CloudFileList>> {
    const allDocs: CloudMeta[] = [];
    let pageToken: string | undefined = undefined;

    while (true) {
      const pageParam = pageToken !== undefined ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
      const url = `${baseUrl}/drive/v3/files?spaces=appDataFolder&fields=nextPageToken,files(id,name,headRevisionId,appProperties)${pageParam}`;
      const res = await dispatch(http, session, 'list', { method: 'GET', url });
      if (res.kind !== 'ok') {
        return res;
      }
      const parsed = readReply('list', res, parseFileList(res.text));
      if (parsed.kind !== 'ok') {
        return parsed;
      }
      for (const doc of parsed.value.docs) {
        allDocs.push(doc);
      }
      if (parsed.value.next === null) {
        break;
      }
      pageToken = parsed.value.next.value;
    }

    return { kind: 'ok', value: { docs: allDocs, next: null } };
  }

  async function changesSince(cursor: ChangeCursor): Promise<CloudResult<CloudChanges>> {
    const allChanged: CloudChange[] = [];
    let currentCursor = cursor.value;

    while (true) {
      const url = `${baseUrl}/drive/v3/changes?spaces=appDataFolder&pageToken=${encodeURIComponent(currentCursor)}&fields=nextPageToken,newStartPageToken,changes(fileId,removed,file(id,name,headRevisionId,appProperties))`;
      const res = await dispatch(http, session, 'changes', { method: 'GET', url });
      if (res.kind !== 'ok') {
        return res;
      }
      const parsed = readReply('changes', res, parseChangeList(res.text));
      if (parsed.kind !== 'ok') {
        return parsed;
      }
      for (const ch of parsed.value.changed) {
        allChanged.push(ch);
      }
      if (parsed.value.kind === 'done') {
        return {
          kind: 'ok',
          value: {
            kind: 'done',
            changed: allChanged,
            newStart: parsed.value.newStart
          }
        };
      }
      currentCursor = parsed.value.next.value;
    }
  }

  async function startCursor(): Promise<CloudResult<ChangeCursor>> {
    const url = `${baseUrl}/drive/v3/changes/startPageToken?spaces=appDataFolder`;
    const res = await dispatch(http, session, 'startCursor', { method: 'GET', url });
    if (res.kind !== 'ok') {
      return res;
    }
    return readReply('startCursor', res, parseStartPageToken(res.text));
  }

  async function read(fileId: FileId): Promise<CloudResult<CloudDoc>> {
    const metaUrl = `${baseUrl}/drive/v3/files/${encodeURIComponent(fileId.value)}?fields=id,name,headRevisionId,appProperties`;
    const metaRes = await dispatch(http, session, 'read', { method: 'GET', url: metaUrl });
    if (metaRes.kind !== 'ok') {
      return metaRes;
    }
    const metaParsed = readReply('read', metaRes, parseFileMetadata(metaRes.text));
    if (metaParsed.kind !== 'ok') {
      return metaParsed;
    }

    const mediaUrl = `${baseUrl}/drive/v3/files/${encodeURIComponent(fileId.value)}?alt=media`;
    const mediaRes = await dispatch(http, session, 'read', { method: 'GET', url: mediaUrl });
    if (mediaRes.kind !== 'ok') {
      return mediaRes;
    }

    return {
      kind: 'ok',
      value: {
        meta: metaParsed.value,
        body: mediaRes.text
      }
    };
  }

  async function create(id: DocId, body: string, meta: WriteMeta): Promise<CloudResult<CloudMeta>> {
    const appProperties: Record<string, string> = {
      app: 'openisd',
      kind: id.kind,
      layout: String(meta.layout),
      seq: String(meta.seq),
      writer: meta.writer,
      hash: meta.hash.value
    };
    if ('uuid' in id) {
      appProperties.uuid = id.uuid;
    }
    if (meta.parentRevision !== null) {
      appProperties.parentRevision = meta.parentRevision.value;
    }

    const metadata = {
      name: docFileName(id),
      parents: ['appDataFolder'],
      appProperties
    };

    const multipartBody =
      `--${MULTIPART_BOUNDARY}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${MULTIPART_BOUNDARY}\r\n` +
      `Content-Type: text/plain; charset=UTF-8\r\n\r\n` +
      `${body}\r\n` +
      `--${MULTIPART_BOUNDARY}--`;

    const url = `${uploadUrl}/drive/v3/files?uploadType=multipart&fields=id,name,headRevisionId,appProperties`;
    const res = await dispatch(http, session, 'create', {
      method: 'POST',
      url,
      headers: {
        'Content-Type': `multipart/related; boundary=${MULTIPART_BOUNDARY}`
      },
      body: multipartBody
    });
    if (res.kind !== 'ok') {
      return res;
    }
    return readReply('create', res, parseWriteReply(res.text));
  }

  async function update(
    fileId: FileId,
    expectedRevision: RevisionId,
    body: string,
    meta: WriteMeta
  ): Promise<CloudResult<CloudMeta>> {
    const headUrl = `${baseUrl}/drive/v3/files/${encodeURIComponent(fileId.value)}?fields=id,name,headRevisionId,appProperties`;
    const headRes = await dispatch(http, session, 'update', { method: 'GET', url: headUrl });
    if (headRes.kind !== 'ok') {
      return headRes;
    }
    const headParsed = readReply('update', headRes, parseFileMetadata(headRes.text));
    if (headParsed.kind !== 'ok') {
      return headParsed;
    }
    const head = headParsed.value;
    if (head.revision.value !== expectedRevision.value) {
      return { kind: 'moved', head };
    }

    const appProperties: Record<string, string> = {
      app: 'openisd',
      kind: head.id.kind,
      layout: String(meta.layout),
      seq: String(meta.seq),
      writer: meta.writer,
      hash: meta.hash.value,
      parentRevision: meta.parentRevision !== null ? meta.parentRevision.value : expectedRevision.value
    };
    if ('uuid' in head.id) {
      appProperties.uuid = head.id.uuid;
    }

    const metadata = {
      appProperties
    };

    const multipartBody =
      `--${MULTIPART_BOUNDARY}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${MULTIPART_BOUNDARY}\r\n` +
      `Content-Type: text/plain; charset=UTF-8\r\n\r\n` +
      `${body}\r\n` +
      `--${MULTIPART_BOUNDARY}--`;

    const updateUrl = `${uploadUrl}/drive/v3/files/${encodeURIComponent(fileId.value)}?uploadType=multipart&fields=id,name,headRevisionId,appProperties`;
    const res = await dispatch(http, session, 'update', {
      method: 'PATCH',
      url: updateUrl,
      headers: {
        'Content-Type': `multipart/related; boundary=${MULTIPART_BOUNDARY}`
      },
      body: multipartBody
    });
    if (res.kind !== 'ok') {
      return res;
    }
    return readReply('update', res, parseWriteReply(res.text));
  }

  async function tombstone(
    fileId: FileId,
    expectedRevision: RevisionId,
    meta: WriteMeta
  ): Promise<CloudResult<CloudMeta>> {
    const headUrl = `${baseUrl}/drive/v3/files/${encodeURIComponent(fileId.value)}?fields=id,name,headRevisionId,appProperties`;
    const headRes = await dispatch(http, session, 'tombstone', { method: 'GET', url: headUrl });
    if (headRes.kind !== 'ok') {
      return headRes;
    }
    const headParsed = readReply('tombstone', headRes, parseFileMetadata(headRes.text));
    if (headParsed.kind !== 'ok') {
      return headParsed;
    }
    const head = headParsed.value;
    if (head.revision.value !== expectedRevision.value) {
      return { kind: 'moved', head };
    }

    const appProperties: Record<string, string> = {
      app: 'openisd',
      kind: head.id.kind,
      layout: String(meta.layout),
      seq: String(meta.seq),
      writer: meta.writer,
      hash: meta.hash.value,
      parentRevision: meta.parentRevision !== null ? meta.parentRevision.value : expectedRevision.value,
      deleted: '1'
    };
    if ('uuid' in head.id) {
      appProperties.uuid = head.id.uuid;
    }

    const patchUrl = `${baseUrl}/drive/v3/files/${encodeURIComponent(fileId.value)}?fields=id,name,headRevisionId,appProperties`;
    const res = await dispatch(http, session, 'tombstone', {
      method: 'PATCH',
      url: patchUrl,
      headers: {
        'Content-Type': 'application/json; charset=UTF-8'
      },
      body: JSON.stringify({ appProperties })
    });
    if (res.kind !== 'ok') {
      return res;
    }
    return readReply('tombstone', res, parseWriteReply(res.text));
  }

  async function removeFile(fileId: FileId): Promise<CloudResult<void>> {
    const url = `${baseUrl}/drive/v3/files/${encodeURIComponent(fileId.value)}`;
    const res = await dispatch(http, session, 'removeDuplicate', { method: 'DELETE', url });
    if (res.kind !== 'ok') {
      return res;
    }
    return { kind: 'ok', value: undefined };
  }

  async function purge(fileId: FileId): Promise<CloudResult<void>> {
    const headUrl = `${baseUrl}/drive/v3/files/${encodeURIComponent(fileId.value)}?fields=id,name,headRevisionId,appProperties`;
    const headRes = await dispatch(http, session, 'purge', { method: 'GET', url: headUrl });
    if (headRes.kind !== 'ok') {
      return headRes;
    }
    const headParsed = readReply('purge', headRes, parseFileMetadata(headRes.text));
    if (headParsed.kind !== 'ok') {
      return headParsed;
    }
    if (!headParsed.value.deleted) {
      return { kind: 'faulted', fault: cloudFaultOf('purge', 400, 'File is not tombstoned', '') };
    }

    const deleteUrl = `${baseUrl}/drive/v3/files/${encodeURIComponent(fileId.value)}`;
    const res = await dispatch(http, session, 'purge', {
      method: 'DELETE',
      url: deleteUrl
    });
    if (res.kind !== 'ok') {
      return res;
    }
    return { kind: 'ok', value: undefined };
  }

  return {
    signedInEmail,
    removeFile,
    listAll,
    changesSince,
    startCursor,
    read,
    create,
    update,
    tombstone,
    purge
  };
}
