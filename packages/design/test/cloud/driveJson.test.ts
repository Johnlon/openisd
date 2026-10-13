import { describe, it, expect } from 'vitest';
import {
  parseFileList,
  parseChangeList,
  parseFileMetadata,
  parseWriteReply,
  parseErrorResponse
} from '../../cloud/driveJson.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = join(fileURLToPath(import.meta.url), '..');
const FIXTURES = join(__dirname, 'fixtures', 'drive');

function fixture(name: string): string {
  return readFileSync(join(FIXTURES, name), 'utf-8');
}

describe('driveJson parsers', () => {
  describe('parseFileList', () => {
    it('parses a valid file list with openisd files', () => {
      const json = fixture('file-list-valid.json');
      const result = parseFileList(json);
      expect(result.kind).toBe('ok');
      if (result.kind === 'ok') {
        expect(result.value.docs.length).toBeGreaterThan(0);
        expect(result.value.next).not.toBeNull();
        expect(result.value.next?.value).toBe('next-page-token-123');
      }
    });

    it('returns next as null when nextPageToken is omitted', () => {
      const json = JSON.stringify({ kind: 'drive#fileList', files: [] });
      const result = parseFileList(json);
      expect(result.kind).toBe('ok');
      if (result.kind === 'ok') {
        expect(result.value.next).toBeNull();
      }
    });

    it('drops files without app=openisd', () => {
      const json = fixture('file-list-mixed.json');
      const result = parseFileList(json);
      expect(result.kind).toBe('ok');
      if (result.kind === 'ok') {
        for (const doc of result.value.docs) {
          expect(doc.id.kind).toMatch(/^(project|driver|pr|settings|favourites)$/);
        }
      }
    });

    it('returns malformed for missing headRevisionId', () => {
      const json = fixture('file-list-missing-headRevisionId.json');
      const result = parseFileList(json);
      expect(result.kind).toBe('malformed');
      if (result.kind === 'malformed') {
        expect(result.reason).toContain('Missing headRevisionId');
      }
    });

    it('returns malformed for invalid JSON', () => {
      const result = parseFileList('not json');
      expect(result.kind).toBe('malformed');
    });

    it('returns malformed for non-file-list response', () => {
      const result = parseFileList('{"kind":"drive#changeList"}');
      expect(result.kind).toBe('malformed');
    });

    it('returns malformed for unknown kind', () => {
      const json = fixture('file-list-unknown-kind.json');
      const result = parseFileList(json);
      expect(result.kind).toBe('malformed');
    });
  });

  describe('parseChangeList', () => {
    it('parses the last page returning done and newStart cursor', () => {
      const json = fixture('change-list-valid.json');
      const result = parseChangeList(json);
      expect(result.kind).toBe('ok');
      if (result.kind === 'ok') {
        expect(result.value.kind).toBe('done');
        if (result.value.kind === 'done') {
          expect(result.value.changed.length).toBeGreaterThan(0);
          expect(result.value.newStart.value).toBe('new-start-token-456');
        }
      }
    });

    it('parses a middle page returning more and next cursor', () => {
      const json = JSON.stringify({
        kind: 'drive#changeList',
        nextPageToken: 'token-middle-123',
        changes: []
      });
      const result = parseChangeList(json);
      expect(result.kind).toBe('ok');
      if (result.kind === 'ok') {
        expect(result.value.kind).toBe('more');
        if (result.value.kind === 'more') {
          expect(result.value.next.value).toBe('token-middle-123');
        }
      }
    });

    it('returns malformed when page has neither nextPageToken nor newStartPageToken', () => {
      const json = JSON.stringify({
        kind: 'drive#changeList',
        changes: []
      });
      const result = parseChangeList(json);
      expect(result.kind).toBe('malformed');
    });

    it('reports removed change as gone entry instead of skipping', () => {
      const json = fixture('change-list-with-deleted.json');
      const result = parseChangeList(json);
      expect(result.kind).toBe('ok');
      if (result.kind === 'ok') {
        expect(result.value.changed).toHaveLength(3);
        const gone = result.value.changed.find(c => 'gone' in c);
        expect(gone).toBeDefined();
        if (gone && 'gone' in gone) {
          expect(gone.fileId.value).toBe('file-deleted');
          expect(gone.gone).toBe(true);
        }
        const metas = result.value.changed.filter(c => !('gone' in c));
        expect(metas).toHaveLength(2);
      }
    });

    it('drops non-openisd files', () => {
      const json = fixture('change-list-mixed.json');
      const result = parseChangeList(json);
      expect(result.kind).toBe('ok');
      if (result.kind === 'ok') {
        for (const doc of result.value.changed) {
          if ('id' in doc) {
            expect(doc.id.kind).toMatch(/^(project|driver|pr|settings|favourites)$/);
          }
        }
      }
    });

    it('returns malformed for missing headRevisionId', () => {
      const json = fixture('change-list-missing-headRevisionId.json');
      const result = parseChangeList(json);
      expect(result.kind).toBe('malformed');
    });

    it('returns cursorExpired for 410', () => {
      const json = fixture('error-410.json');
      const result = parseErrorResponse(410, json);
      expect(result.kind).toBe('cursorExpired');
    });
  });

  describe('parseFileMetadata', () => {
    it('parses valid file metadata', () => {
      const json = fixture('file-metadata-valid.json');
      const result = parseFileMetadata(json);
      expect(result.kind).toBe('ok');
      if (result.kind === 'ok') {
        expect(result.value.fileId).toBeDefined();
        expect(result.value.revision).toBeDefined();
      }
    });

    it('returns malformed for missing headRevisionId', () => {
      const json = fixture('file-metadata-missing-headRevisionId.json');
      const result = parseFileMetadata(json);
      expect(result.kind).toBe('malformed');
      if (result.kind === 'malformed') {
        expect(result.reason).toContain('Missing headRevisionId');
      }
    });

    it('returns malformed for missing appProperties', () => {
      const json = fixture('file-metadata-missing-appProperties.json');
      const result = parseFileMetadata(json);
      expect(result.kind).toBe('malformed');
    });
  });

  describe('parseWriteReply', () => {
    it('parses valid create/update reply', () => {
      const json = fixture('write-reply-valid.json');
      const result = parseWriteReply(json);
      expect(result.kind).toBe('ok');
      if (result.kind === 'ok') {
        expect(result.value.fileId).toBeDefined();
        expect(result.value.revision).toBeDefined();
      }
    });

    it('returns malformed for missing headRevisionId', () => {
      const json = fixture('write-reply-missing-headRevisionId.json');
      const result = parseWriteReply(json);
      expect(result.kind).toBe('malformed');
    });
  });

  describe('parseErrorResponse', () => {
    it('returns unauthorised for 401', () => {
      const json = fixture('error-401.json');
      const result = parseErrorResponse(401, json);
      expect(result.kind).toBe('unauthorised');
    });

    it('returns quota with retryAfter for 403 rate limit', () => {
      const json = fixture('error-403-rate-limit.json');
      const result = parseErrorResponse(403, json);
      expect(result.kind).toBe('quota');
      if (result.kind === 'quota') {
        expect(result.retryAfter_ms).toBeGreaterThan(0);
      }
    });

    it('returns cursorExpired for 410', () => {
      const json = fixture('error-410.json');
      const result = parseErrorResponse(410, json);
      expect(result.kind).toBe('cursorExpired');
    });

    it('returns failed for other errors', () => {
      const json = fixture('error-500.json');
      const result = parseErrorResponse(500, json);
      expect(result.kind).toBe('failed');
      if (result.kind === 'failed') {
        expect(result.status).toBe(500);
      }
    });

    it('returns failed for invalid JSON', () => {
      const result = parseErrorResponse(400, 'not json');
      expect(result.kind).toBe('failed');
    });
  });
});