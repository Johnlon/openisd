import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDriveStore } from '../../src/cloud/drive/driveStore.js';
import type { Http, HttpRequest, HttpResponse } from '../../src/cloud/http.js';
import type { CloudSession } from '../../src/cloud/cloudStore.js';
import {
  FileId,
  RevisionId,
  ChangeCursor,
  BodyHash,
  type DocId,
  type WriteMeta,
} from '@openisd/design/cloud';

const __dirname = join(fileURLToPath(import.meta.url), '..');
const FIXTURES = join(__dirname, 'fixtures', 'drive');

function fixture(name: string): string {
  return readFileSync(join(FIXTURES, name), 'utf-8');
}

class FakeHttp implements Http {
  readonly recorded: HttpRequest[] = [];
  private responses: (HttpResponse | { readonly kind: 'offline' })[] = [];

  queueResponse(res: HttpResponse | { readonly kind: 'offline' }): void {
    this.responses.push(res);
  }

  async send(request: HttpRequest): Promise<HttpResponse | { readonly kind: 'offline' }> {
    this.recorded.push(request);
    const next = this.responses.shift();
    if (!next) {
      throw new Error(`Unexpected HTTP request: ${request.method} ${request.url}`);
    }
    return next;
  }
}

class FakeCloudSession implements CloudSession {
  nameAccount(): void {}
  private tokenResult:
    | { readonly kind: 'ok'; readonly token: string }
    | { readonly kind: 'none' }
    | { readonly kind: 'reconnect' }
    | { readonly kind: 'offline' } = { kind: 'ok', token: 'mock-access-token-123' };

  setTokenResult(
    res:
      | { readonly kind: 'ok'; readonly token: string }
      | { readonly kind: 'none' }
      | { readonly kind: 'reconnect' }
      | { readonly kind: 'offline' }
  ): void {
    this.tokenResult = res;
  }

  grant() {
    return { kind: 'connected' as const, account: 'user@example.com' };
  }

  async accessToken() {
    return this.tokenResult;
  }

  async onBoot() {
    return { kind: 'notACallback' as const };
  }

  beginConnect(): void {}

  async disconnect(): Promise<void> {}
}

describe('DriveStore', () => {
  let http: FakeHttp;
  let session: FakeCloudSession;

  beforeEach(() => {
    http = new FakeHttp();
    session = new FakeCloudSession();
  });

  describe('listAll', () => {
    it('fetches single page of files in appDataFolder with token and fields', async () => {
      const store = createDriveStore({ http, session });
      http.queueResponse({
        status: 200,
        text: JSON.stringify({ kind: 'drive#fileList', files: [] })
      });

      const res = await store.listAll();
      expect(res.kind).toBe('ok');
      expect(http.recorded).toHaveLength(1);
      const req = http.recorded[0];
      expect(req.method).toBe('GET');
      expect(req.url).toContain('https://www.googleapis.com/drive/v3/files');
      expect(req.url).toContain('spaces=appDataFolder');
      expect(req.url).toContain('fields=nextPageToken,files(id,name,headRevisionId,appProperties)');
      expect(req.headers?.['Authorization']).toBe('Bearer mock-access-token-123');
    });

    it('fetches all pages for multi-page list', async () => {
      const store = createDriveStore({ http, session });
      http.queueResponse({
        status: 200,
        text: fixture('file-list-valid.json') // has nextPageToken "next-page-token-123" and 3 files
      });
      http.queueResponse({
        status: 200,
        text: fixture('file-list-page2.json') // 1 file, no nextPageToken
      });

      const res = await store.listAll();
      expect(res.kind).toBe('ok');
      if (res.kind === 'ok') {
        expect(res.value.docs).toHaveLength(4);
      }
      expect(http.recorded).toHaveLength(2);
      expect(http.recorded[0].url).not.toContain('pageToken');
      expect(http.recorded[1].url).toContain('pageToken=next-page-token-123');
    });
  });

  describe('changesSince', () => {
    it('fetches single page of changes until done', async () => {
      const store = createDriveStore({ http, session });
      const cursor = ChangeCursor.of('cursor-initial');
      expect(cursor).not.toBeNull();
      if (!cursor) return;

      http.queueResponse({
        status: 200,
        text: fixture('change-list-valid.json') // done with newStartPageToken
      });

      const res = await store.changesSince(cursor);
      expect(res.kind).toBe('ok');
      if (res.kind === 'ok') {
        expect(res.value.kind).toBe('done');
        if (res.value.kind === 'done') {
          expect(res.value.newStart.value).toBe('new-start-token-456');
          expect(res.value.changed.length).toBeGreaterThan(0);
        }
      }
      expect(http.recorded).toHaveLength(1);
      const req = http.recorded[0];
      expect(req.method).toBe('GET');
      expect(req.url).toContain('https://www.googleapis.com/drive/v3/changes');
      expect(req.url).toContain('spaces=appDataFolder');
      expect(req.url).toContain('pageToken=cursor-initial');
    });

    it('pages multi-page changes until done', async () => {
      const store = createDriveStore({ http, session });
      const cursor = ChangeCursor.of('cursor-start');
      expect(cursor).not.toBeNull();
      if (!cursor) return;

      http.queueResponse({
        status: 200,
        text: fixture('change-list-page1.json') // more with nextPageToken "changes-page-2-token"
      });
      http.queueResponse({
        status: 200,
        text: fixture('change-list-valid.json') // done with newStartPageToken
      });

      const res = await store.changesSince(cursor);
      expect(res.kind).toBe('ok');
      if (res.kind === 'ok') {
        expect(res.value.kind).toBe('done');
        if (res.value.kind === 'done') {
          expect(res.value.newStart.value).toBe('new-start-token-456');
          expect(res.value.changed.length).toBeGreaterThanOrEqual(2);
        }
      }
      expect(http.recorded).toHaveLength(2);
      expect(http.recorded[0].url).toContain('pageToken=cursor-start');
      expect(http.recorded[1].url).toContain('pageToken=changes-page-2-token');
    });
  });

  describe('startCursor', () => {
    it('requests startPageToken with spaces=appDataFolder', async () => {
      const store = createDriveStore({ http, session });
      http.queueResponse({
        status: 200,
        text: fixture('start-page-token-valid.json')
      });

      const res = await store.startCursor();
      expect(res.kind).toBe('ok');
      if (res.kind === 'ok') {
        expect(res.value.value).toBe('start-page-token-123');
      }
      expect(http.recorded).toHaveLength(1);
      const req = http.recorded[0];
      expect(req.method).toBe('GET');
      expect(req.url).toBe('https://www.googleapis.com/drive/v3/changes/startPageToken?spaces=appDataFolder');
      expect(req.headers?.['Authorization']).toBe('Bearer mock-access-token-123');
    });
  });

  describe('read', () => {
    it('fetches metadata and body (alt=media)', async () => {
      const store = createDriveStore({ http, session });
      const fid = FileId.of('file-1');
      expect(fid).not.toBeNull();
      if (!fid) return;

      http.queueResponse({
        status: 200,
        text: fixture('file-metadata-valid.json')
      });
      http.queueResponse({
        status: 200,
        text: 'file body content here'
      });

      const res = await store.read(fid);
      expect(res.kind).toBe('ok');
      if (res.kind === 'ok') {
        expect(res.value.meta.fileId.value).toBe('file-1');
        expect(res.value.body).toBe('file body content here');
      }
      expect(http.recorded).toHaveLength(2);
      expect(http.recorded[0].method).toBe('GET');
      expect(http.recorded[0].url).toContain('https://www.googleapis.com/drive/v3/files/file-1');
      expect(http.recorded[0].url).toContain('fields=id,name,headRevisionId,appProperties');
      expect(http.recorded[1].method).toBe('GET');
      expect(http.recorded[1].url).toBe('https://www.googleapis.com/drive/v3/files/file-1?alt=media');
    });
  });

  describe('create', () => {
    it('uploads multipart into appDataFolder with appProperties', async () => {
      const store = createDriveStore({ http, session });
      const docId: DocId = { kind: 'project', uuid: 'new-789' };
      const hash = BodyHash.of('d4e5f6a7b8c9');
      expect(hash).not.toBeNull();
      if (!hash) return;

      const meta: WriteMeta = {
        parentRevision: null,
        layout: 2,
        seq: 1,
        writer: 'device-1',
        hash
      };

      http.queueResponse({
        status: 200,
        text: fixture('write-reply-valid.json')
      });

      const res = await store.create(docId, 'project body text', meta);
      expect(res.kind).toBe('ok');
      if (res.kind === 'ok') {
        expect(res.value.fileId.value).toBe('file-new');
        expect(res.value.revision.value).toBe('rev-new');
      }

      expect(http.recorded).toHaveLength(1);
      const req = http.recorded[0];
      expect(req.method).toBe('POST');
      expect(req.url).toContain('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart');
      expect(req.url).toContain('fields=id,name,headRevisionId,appProperties');
      expect(req.headers?.['Content-Type']).toMatch(/^multipart\/related; boundary=/);
      expect(req.headers?.['Authorization']).toBe('Bearer mock-access-token-123');
      expect(req.body).toContain('"parents":["appDataFolder"]');
      expect(req.body).toContain('"app":"openisd"');
      expect(req.body).toContain('"kind":"project"');
      expect(req.body).toContain('"uuid":"new-789"');
      expect(req.body).toContain('project body text');
    });
  });

  describe('update', () => {
    const meta: WriteMeta = {
      parentRevision: RevisionId.of('rev-head-match'),
      layout: 2,
      seq: 2,
      writer: 'device-1',
      hash: BodyHash.of('hash-updated')!
    };

    it('checks head revision first; updates via multipart PATCH when head matches', async () => {
      const store = createDriveStore({ http, session });
      const fid = FileId.of('file-update');
      const expectedRev = RevisionId.of('rev-1');
      expect(fid && expectedRev).toBeTruthy();
      if (!fid || !expectedRev) return;

      // Head check response matching expectedRev
      http.queueResponse({
        status: 200,
        text: fixture('file-metadata-valid.json') // headRevisionId: rev-1
      });
      // Multipart PATCH response
      http.queueResponse({
        status: 200,
        text: fixture('write-reply-valid.json')
      });

      const res = await store.update(fid, expectedRev, 'updated body', meta);
      expect(res.kind).toBe('ok');
      expect(http.recorded).toHaveLength(2);
      expect(http.recorded[0].method).toBe('GET');
      expect(http.recorded[0].url).toContain('/files/file-update');
      expect(http.recorded[1].method).toBe('PATCH');
      expect(http.recorded[1].url).toContain('/upload/drive/v3/files/file-update?uploadType=multipart');
      expect(http.recorded[1].body).toContain('updated body');
    });

    it('answers moved and sends no write if head revision differs from expected revision', async () => {
      const store = createDriveStore({ http, session });
      const fid = FileId.of('file-update');
      const expectedRev = RevisionId.of('rev-stale-000');
      expect(fid && expectedRev).toBeTruthy();
      if (!fid || !expectedRev) return;

      // Head check returns rev-1 which differs from rev-stale-000
      http.queueResponse({
        status: 200,
        text: fixture('file-metadata-valid.json') // headRevisionId: rev-1
      });

      const res = await store.update(fid, expectedRev, 'updated body', meta);
      expect(res.kind).toBe('moved');
      if (res.kind === 'moved') {
        expect(res.head.revision.value).toBe('rev-1');
      }
      expect(http.recorded).toHaveLength(1);
      expect(http.recorded[0].method).toBe('GET');
    });
  });

  describe('tombstone', () => {
    const meta: WriteMeta = {
      parentRevision: RevisionId.of('rev-1'),
      layout: 2,
      seq: 3,
      writer: 'device-1',
      hash: BodyHash.of('hash-del')!
    };

    it('checks head first and writes deleted=1 via PATCH when head matches', async () => {
      const store = createDriveStore({ http, session });
      const fid = FileId.of('file-del');
      const expectedRev = RevisionId.of('rev-1');
      expect(fid && expectedRev).toBeTruthy();
      if (!fid || !expectedRev) return;

      http.queueResponse({
        status: 200,
        text: fixture('file-metadata-valid.json')
      });
      http.queueResponse({
        status: 200,
        text: fixture('file-metadata-tombstone.json')
      });

      const res = await store.tombstone(fid, expectedRev, meta);
      expect(res.kind).toBe('ok');
      if (res.kind === 'ok') {
        expect(res.value.deleted).toBe(true);
      }
      expect(http.recorded).toHaveLength(2);
      expect(http.recorded[0].method).toBe('GET');
      expect(http.recorded[1].method).toBe('PATCH');
      expect(http.recorded[1].body).toContain('"deleted":"1"');
    });

    it('answers moved and sends no write if head revision differs', async () => {
      const store = createDriveStore({ http, session });
      const fid = FileId.of('file-del');
      const expectedRev = RevisionId.of('rev-stale');
      expect(fid && expectedRev).toBeTruthy();
      if (!fid || !expectedRev) return;

      http.queueResponse({
        status: 200,
        text: fixture('file-metadata-valid.json')
      });

      const res = await store.tombstone(fid, expectedRev, meta);
      expect(res.kind).toBe('moved');
      expect(http.recorded).toHaveLength(1);
    });
  });

  describe('purge', () => {
    it('refuses purge of a live file and sends no DELETE', async () => {
      const store = createDriveStore({ http, session });
      const fid = FileId.of('file-live');
      expect(fid).not.toBeNull();
      if (!fid) return;

      http.queueResponse({
        status: 200,
        text: fixture('file-metadata-valid.json') // deleted is false
      });

      const res = await store.purge(fid);
      expect(res.kind).toBe('faulted');
      if (res.kind === 'faulted') {
        expect(res.fault.reason).toContain('tombstone');
      }
      expect(http.recorded).toHaveLength(1);
      expect(http.recorded[0].method).toBe('GET');
    });

    it('deletes a tombstoned file', async () => {
      const store = createDriveStore({ http, session });
      const fid = FileId.of('file-tombstone-1');
      expect(fid).not.toBeNull();
      if (!fid) return;

      http.queueResponse({
        status: 200,
        text: fixture('file-metadata-tombstone.json') // deleted is true
      });
      http.queueResponse({
        status: 204,
        text: ''
      });

      const res = await store.purge(fid);
      expect(res.kind).toBe('ok');
      expect(http.recorded).toHaveLength(2);
      expect(http.recorded[0].method).toBe('GET');
      expect(http.recorded[1].method).toBe('DELETE');
      expect(http.recorded[1].url).toBe('https://www.googleapis.com/drive/v3/files/file-tombstone-1');
    });
  });

  describe('error and offline mapping', () => {
    it('signedInEmail asks Drive about the user and returns the email', async () => {
      const store = createDriveStore({ http, session });
      http.queueResponse({ status: 200, text: JSON.stringify({ user: { emailAddress: 'john@example.com' } }) });
      const res = await store.signedInEmail();
      expect(res).toEqual({ kind: 'ok', value: 'john@example.com' });
      expect(http.recorded[0]?.url).toBe('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)');
      expect(http.recorded[0]?.method).toBe('GET');
    });

    it('signedInEmail refused by Google is a fault naming the about request and the status', async () => {
      const store = createDriveStore({ http, session });
      const body = JSON.stringify({ error: { code: 403, message: 'Insufficient Permission', errors: [{ reason: 'insufficientPermissions' }] } });
      http.queueResponse({ status: 403, text: body });
      const res = await store.signedInEmail();
      expect(res.kind).toBe('faulted');
      if (res.kind !== 'faulted') return;
      expect(res.fault.operation).toBe('about');
      expect(res.fault.status).toBe(403);
    });

    it('a reply the parser refuses is a fault naming the request, the status and the reply start', async () => {
      const store = createDriveStore({ http, session });
      const reply = JSON.stringify({ files: 'none' }) + ' '.repeat(400);
      http.queueResponse({ status: 200, text: reply });

      const res = await store.listAll();
      expect(res.kind).toBe('faulted');
      if (res.kind !== 'faulted') return;
      expect(res.fault).toEqual({ operation: 'list', status: 200, reason: 'Not a file list', reply: reply.slice(0, 300) });
    });

    it('a Drive error reply is a fault carrying Drive\'s status and body', async () => {
      const store = createDriveStore({ http, session });
      const body = JSON.stringify({ error: { code: 403, message: 'Request had insufficient authentication scopes.', errors: [{ reason: 'insufficientPermissions' }] } });
      http.queueResponse({ status: 403, text: body });

      const res = await store.listAll();
      expect(res.kind).toBe('faulted');
      if (res.kind !== 'faulted') return;
      expect(res.fault.operation).toBe('list');
      expect(res.fault.status).toBe(403);
      expect(res.fault.reason).toBe('insufficientPermissions');
      expect(res.fault.reply).toBe(body);
    });

    it('maps 401 to unauthorised', async () => {
      const store = createDriveStore({ http, session });
      http.queueResponse({
        status: 401,
        text: fixture('error-401.json')
      });

      const res = await store.listAll();
      expect(res.kind).toBe('unauthorised');
    });

    it('maps 403 rate limit with Retry-After header to quota', async () => {
      const store = createDriveStore({ http, session });
      http.queueResponse({
        status: 403,
        text: fixture('error-403-rate-limit.json'),
        headers: { 'Retry-After': '5' }
      });

      const res = await store.listAll();
      expect(res.kind).toBe('quota');
      if (res.kind === 'quota') {
        expect(res.retryAfter_ms).toBe(5000);
      }
    });

    it('maps 403 rate limit without Retry-After header to quota with 1000ms backoff', async () => {
      const store = createDriveStore({ http, session });
      http.queueResponse({
        status: 403,
        text: fixture('error-403-rate-limit.json')
      });

      const res = await store.listAll();
      expect(res.kind).toBe('quota');
      if (res.kind === 'quota') {
        expect(res.retryAfter_ms).toBe(1000);
      }
    });

    it('maps session offline to offline without making HTTP requests', async () => {
      session.setTokenResult({ kind: 'offline' });
      const store = createDriveStore({ http, session });

      const res = await store.listAll();
      expect(res.kind).toBe('offline');
      expect(http.recorded).toHaveLength(0);
    });

    it('maps HTTP offline to offline', async () => {
      const store = createDriveStore({ http, session });
      http.queueResponse({ kind: 'offline' });

      const res = await store.listAll();
      expect(res.kind).toBe('offline');
    });

    it('maps 410 to cursorExpired', async () => {
      const store = createDriveStore({ http, session });
      const cursor = ChangeCursor.of('expired-cursor')!;

      http.queueResponse({
        status: 410,
        text: fixture('error-410.json')
      });

      const res = await store.changesSince(cursor);
      expect(res.kind).toBe('cursorExpired');
    });
  });
});
